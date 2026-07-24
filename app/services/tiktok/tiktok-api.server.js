import { parseTikTokResponse, safeTikTokError } from "./tiktok-errors.server.js";
import { getValidTikTokAccessToken } from "./tiktok-token.server.js";
import { uploadChunks } from "./tiktok-media.server.js";

const API = "https://open.tiktokapis.com";

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestWithRetry(url, options, { fetchImpl = fetch, retries = 2 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetchImpl(url, options);
      if ((response.status === 429 || response.status >= 500) && attempt < retries) {
        await wait(250 * (2 ** attempt));
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < retries) await wait(250 * (2 ** attempt));
    }
  }
  throw lastError || new Error("TikTok request failed");
}

async function jsonRequest(path, token, body, options = {}) {
  const response = await requestWithRetry(`${API}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json; charset=UTF-8" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }, options);
  return parseTikTokResponse(response, await response.json());
}

export async function queryTikTokUploadCreator(shop, options = {}) {
  const { token, connection } = await getValidTikTokAccessToken(shop, options);
  const fields = "open_id,avatar_url,display_name,username";
  const profile = await jsonRequest(`/v2/user/info/?fields=${fields}`, token, null, options);
  return { token, connection, creator: profile.data?.user || {} };
}

export async function queryTikTokDirectPostCreator(shop, options = {}) {
  const { token, connection } = await getValidTikTokAccessToken(shop, options);
  if (!connection.scopes.split(",").includes("video.publish")) {
    throw new Error("Direct Post ist vorbereitet, aber video.publish wurde noch nicht freigegeben.");
  }
  const result = await jsonRequest("/v2/post/publish/creator_info/query/", token, {}, options);
  return { token, connection, creator: result.data };
}

export async function uploadTikTokDraft({ shop, buffer, mimeType, onProgress, fetchImpl = fetch }) {
  const { token, creator } = await queryTikTokUploadCreator(shop, { fetchImpl });
  if (!creator.open_id) throw new Error("Das verbundene TikTok-Konto konnte nicht bestätigt werden.");
  const { chunkSize, count } = uploadChunks(buffer.length);
  try {
    const initialized = await jsonRequest("/v2/post/publish/inbox/video/init/", token, {
      source_info: {
        source: "FILE_UPLOAD",
        video_size: buffer.length,
        chunk_size: chunkSize,
        total_chunk_count: count,
      },
    }, { fetchImpl });
    const publishId = initialized.data?.publish_id;
    const uploadUrl = initialized.data?.upload_url;
    if (!publishId || !uploadUrl) throw new Error("TikTok hat keine Upload-Zieladresse geliefert.");
    let first = 0;
    for (let index = 0; index < count; index += 1) {
      const lastChunk = index === count - 1;
      const endExclusive = lastChunk ? buffer.length : first + chunkSize;
      const chunk = buffer.subarray(first, endExclusive);
      const response = await requestWithRetry(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": mimeType,
          "Content-Length": String(chunk.length),
          "Content-Range": `bytes ${first}-${endExclusive - 1}/${buffer.length}`,
        },
        body: chunk,
      }, { fetchImpl });
      if (![201, 206].includes(response.status)) {
        const error = new Error("TikTok upload failed");
        error.status = response.status;
        error.code = `upload_http_${response.status}`;
        throw error;
      }
      first = endExclusive;
      if (onProgress) await onProgress(Math.round((first / buffer.length) * 100));
    }
    return { publishId, logId: initialized.error?.log_id || null };
  } catch (error) {
    const safe = safeTikTokError(error);
    const wrapped = new Error(safe.message);
    Object.assign(wrapped, safe);
    throw wrapped;
  }
}

export async function fetchTikTokPostStatus({ shop, publishId, fetchImpl = fetch }) {
  const { token } = await getValidTikTokAccessToken(shop, { fetchImpl });
  try {
    const result = await jsonRequest("/v2/post/publish/status/fetch/", token, { publish_id: publishId }, { fetchImpl, retries: 1 });
    return { ...result.data, logId: result.error?.log_id || null };
  } catch (error) {
    const safe = safeTikTokError(error);
    const wrapped = new Error(safe.message);
    Object.assign(wrapped, safe);
    throw wrapped;
  }
}

export async function initializeTikTokPullFromUrl({ shop, videoUrl, fetchImpl = fetch }) {
  const url = new URL(videoUrl);
  if (url.protocol !== "https:") throw new Error("PULL_FROM_URL erfordert eine HTTPS-Adresse.");
  const { token } = await getValidTikTokAccessToken(shop, { fetchImpl });
  const initialized = await jsonRequest("/v2/post/publish/inbox/video/init/", token, {
    source_info: { source: "PULL_FROM_URL", video_url: url.toString() },
  }, { fetchImpl });
  return {
    publishId: initialized.data?.publish_id,
    logId: initialized.error?.log_id || null,
  };
}

export async function initializeTikTokDirectPost() {
  throw new Error("Direct Post ist technisch vorbereitet, aber bis zur TikTok-Freigabe deaktiviert.");
}
