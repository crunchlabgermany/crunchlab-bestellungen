import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import db from "../../db.server.js";
import { uploadTikTokDraft, fetchTikTokPostStatus } from "./tiktok-api.server.js";

export const TIKTOK_POST_STATUSES = ["DRAFT", "SCHEDULED", "UPLOADING", "UPLOADED", "PUBLISHED", "FAILED"];
const MAX_RETRIES = 3;

export function composeTikTokCaption(caption, hashtags) {
  const tags = String(hashtags || "").split(/[\s,]+/).filter(Boolean).map((tag) => tag.startsWith("#") ? tag : `#${tag}`);
  return [String(caption || "").trim(), tags.join(" ")].filter(Boolean).join("\n\n").slice(0, 2200);
}

export function transitionTikTokStatus(current, next) {
  const allowed = {
    DRAFT: ["SCHEDULED", "UPLOADING", "FAILED"],
    SCHEDULED: ["UPLOADING", "FAILED"],
    UPLOADING: ["UPLOADED", "FAILED"],
    UPLOADED: ["PUBLISHED", "FAILED"],
    PUBLISHED: [],
    FAILED: ["SCHEDULED", "UPLOADING"],
  };
  if (!allowed[current]?.includes(next)) throw new Error(`Ungültiger TikTok-Statuswechsel: ${current} → ${next}`);
  return next;
}

export async function uploadStoredTikTokPost(postId, { fetchImpl = fetch } = {}) {
  const post = await db.socialPost.findUnique({
    where: { id: postId },
    include: { assets: { include: { asset: { include: { blob: true } } } } },
  });
  if (!post || post.platform !== "TIKTOK") throw new Error("TikTok-Beitrag nicht gefunden.");
  const asset = post.assets[0]?.asset;
  if (!asset?.blob?.data) throw new Error("Videodatei fehlt.");
  transitionTikTokStatus(post.status, "UPLOADING");
  await db.socialPost.update({ where: { id: post.id }, data: { status: "UPLOADING", uploadProgress: 0, errorMessage: null } });
  try {
    const result = await uploadTikTokDraft({
      shop: post.shop,
      buffer: Buffer.from(asset.blob.data),
      mimeType: asset.mimeType,
      fetchImpl,
      onProgress: (uploadProgress) => db.socialPost.update({ where: { id: post.id }, data: { uploadProgress } }),
    });
    await db.socialPost.update({
      where: { id: post.id },
      data: { status: "UPLOADED", uploadProgress: 100, externalPostId: result.publishId, tiktokLogId: result.logId },
    });
    return { publishId: result.publishId };
  } catch (error) {
    const retryCount = post.retryCount + 1;
    await db.socialPost.update({
      where: { id: post.id },
      data: {
        status: "FAILED",
        retryCount,
        nextRetryAt: error.retryable && retryCount < MAX_RETRIES ? new Date(Date.now() + 15 * 60 * 1000 * retryCount) : null,
        errorMessage: String(error.message).slice(0, 500),
        tiktokLogId: error.logId || post.tiktokLogId,
      },
    });
    throw error;
  }
}

export async function createTikTokPost({ shop, videoPath, assetId, caption, hashtags, scheduledAt }) {
  const connection = await db.tikTokConnection.findUnique({ where: { shop } });
  if (!connection || connection.status !== "CONNECTED") throw new Error("TikTok ist nicht verbunden.");
  let resolvedAssetId = Number(assetId) || null;
  if (!resolvedAssetId && videoPath) {
    const buffer = await readFile(videoPath);
    const asset = await db.socialMediaAsset.create({
      data: {
        shop,
        fileName: basename(videoPath),
        originalName: basename(videoPath),
        mimeType: "video/mp4",
        fileType: "VIDEO",
        storageUrl: "internal",
        fileSize: buffer.length,
        blob: { create: { data: buffer } },
      },
    });
    resolvedAssetId = asset.id;
  }
  if (!resolvedAssetId) throw new Error("Videodatei fehlt.");
  const scheduleDate = scheduledAt ? new Date(scheduledAt) : null;
  const scheduled = scheduleDate && scheduleDate.getTime() > Date.now();
  const post = await db.socialPost.create({
    data: {
      shop,
      platform: "TIKTOK",
      postType: "VIDEO",
      description: composeTikTokCaption(caption, hashtags),
      caption: String(caption || "").trim() || null,
      hashtags: String(hashtags || "").trim() || null,
      mediaStorageKey: `social-asset:${resolvedAssetId}`,
      status: scheduled ? "SCHEDULED" : "DRAFT",
      scheduledFor: scheduled ? scheduleDate : null,
      assets: { create: { assetId: resolvedAssetId, position: 0 } },
    },
  });
  if (!scheduled) {
    await uploadStoredTikTokPost(post.id);
    return db.socialPost.findUnique({ where: { id: post.id } });
  }
  return post;
}

export async function refreshTikTokPostStatus(postId, options = {}) {
  const post = await db.socialPost.findUnique({ where: { id: postId } });
  if (!post?.externalPostId) throw new Error("TikTok Upload-ID fehlt.");
  const result = await fetchTikTokPostStatus({ shop: post.shop, publishId: post.externalPostId, ...options });
  const data = { lastStatusCheckedAt: new Date(), tiktokLogId: result.logId || post.tiktokLogId };
  if (result.status === "FAILED") Object.assign(data, { status: "FAILED", errorMessage: result.fail_reason || "TikTok-Verarbeitung fehlgeschlagen." });
  else if (result.status === "PUBLISH_COMPLETE") Object.assign(data, { status: "PUBLISHED", publishedAt: new Date() });
  else Object.assign(data, { status: "UPLOADED", uploadProgress: result.uploaded_bytes ? 100 : post.uploadProgress });
  return db.socialPost.update({ where: { id: post.id }, data });
}

export async function runTikTokScheduledPosts({ now = new Date(), limit = 5, fetchImpl = fetch } = {}) {
  const posts = await db.socialPost.findMany({
    where: {
      platform: "TIKTOK",
      OR: [
        { status: "SCHEDULED", scheduledFor: { lte: now } },
        { status: "FAILED", retryCount: { lt: MAX_RETRIES }, nextRetryAt: { lte: now } },
      ],
    },
    orderBy: { scheduledFor: "asc" },
    take: Math.min(limit, 10),
  });
  const results = [];
  for (const post of posts) {
    try {
      await uploadStoredTikTokPost(post.id, { fetchImpl });
      results.push({ id: post.id, ok: true });
    } catch {
      results.push({ id: post.id, ok: false });
    }
  }
  return results;
}
