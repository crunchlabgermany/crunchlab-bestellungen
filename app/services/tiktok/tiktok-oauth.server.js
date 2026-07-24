import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import db from "../../db.server.js";
import { encryptTikTokSecret } from "./tiktok-crypto.server.js";
import { parseTikTokResponse, safeTikTokError } from "./tiktok-errors.server.js";

export const TIKTOK_SCOPES = [
  "user.info.basic",
  "user.info.profile",
  "user.info.stats",
  "video.list",
  "video.upload",
];
export const TIKTOK_REDIRECT_URI = "https://crunch-lab.de/api/tiktok/callback";

export function tiktokConfiguration() {
  const redirectUri = process.env.TIKTOK_REDIRECT_URI || TIKTOK_REDIRECT_URI;
  return {
    clientKey: process.env.TIKTOK_CLIENT_KEY || null,
    redirectUri,
    environment: process.env.TIKTOK_ENV || "sandbox",
    configured: Boolean(
      process.env.TIKTOK_CLIENT_KEY &&
      process.env.TIKTOK_CLIENT_SECRET &&
      process.env.TIKTOK_TOKEN_ENCRYPTION_KEY &&
      redirectUri === TIKTOK_REDIRECT_URI,
    ),
    redirectMatches: redirectUri === TIKTOK_REDIRECT_URI,
  };
}

export function hashOAuthState(state) {
  return createHash("sha256").update(state).digest("hex");
}

export function statesMatch(left, right) {
  const a = Buffer.from(hashOAuthState(String(left)));
  const b = Buffer.from(hashOAuthState(String(right)));
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function createTikTokAuthorization(shop) {
  const config = tiktokConfiguration();
  if (!config.configured) throw new Error("TikTok OAuth ist noch nicht vollständig konfiguriert.");
  const state = randomBytes(32).toString("base64url");
  await db.tikTokOAuthState.create({
    data: { shop, stateHash: hashOAuthState(state), expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
  });
  const query = new URLSearchParams({
    client_key: config.clientKey,
    response_type: "code",
    scope: TIKTOK_SCOPES.join(","),
    redirect_uri: config.redirectUri,
    state,
  });
  return `https://www.tiktok.com/v2/auth/authorize/?${query}`;
}

async function consumeState(state) {
  const stateHash = hashOAuthState(state);
  const record = await db.tikTokOAuthState.findUnique({ where: { stateHash } });
  if (!record || record.consumedAt || record.expiresAt <= new Date()) {
    throw new Error("Die TikTok-Anmeldung ist abgelaufen oder der Sicherheitswert ist ungültig.");
  }
  const consumed = await db.tikTokOAuthState.updateMany({
    where: { id: record.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (consumed.count !== 1) throw new Error("Diese TikTok-Anmeldung wurde bereits verwendet.");
  return record;
}

async function exchangeAuthorizationCode(code) {
  const config = tiktokConfiguration();
  const body = new URLSearchParams({
    client_key: config.clientKey,
    client_secret: process.env.TIKTOK_CLIENT_SECRET,
    code,
    grant_type: "authorization_code",
    redirect_uri: config.redirectUri,
  });
  const response = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" },
    body,
  });
  return parseTikTokResponse(response, await response.json());
}

async function fetchProfile(accessToken) {
  const fields = "open_id,avatar_url,display_name,username,bio_description,profile_deep_link,is_verified,follower_count,following_count,likes_count,video_count";
  const response = await fetch(`https://open.tiktokapis.com/v2/user/info/?fields=${fields}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = parseTikTokResponse(response, await response.json());
  return body.data?.user || {};
}

export async function completeTikTokOAuth({ state, code }) {
  const record = await consumeState(state);
  try {
    const tokens = await exchangeAuthorizationCode(code);
    const profile = await fetchProfile(tokens.access_token);
    const now = Date.now();
    const connection = await db.tikTokConnection.upsert({
      where: { shop: record.shop },
      create: {
        shop: record.shop,
        openId: tokens.open_id,
        username: profile.username || null,
        displayName: profile.display_name || null,
        avatarUrl: profile.avatar_url || null,
        accessTokenEncrypted: encryptTikTokSecret(tokens.access_token),
        refreshTokenEncrypted: encryptTikTokSecret(tokens.refresh_token),
        accessTokenExpiresAt: new Date(now + Number(tokens.expires_in) * 1000),
        refreshTokenExpiresAt: new Date(now + Number(tokens.refresh_expires_in) * 1000),
        scopes: tokens.scope || "",
        status: "CONNECTED",
      },
      update: {
        openId: tokens.open_id,
        username: profile.username || null,
        displayName: profile.display_name || null,
        avatarUrl: profile.avatar_url || null,
        accessTokenEncrypted: encryptTikTokSecret(tokens.access_token),
        refreshTokenEncrypted: encryptTikTokSecret(tokens.refresh_token),
        accessTokenExpiresAt: new Date(now + Number(tokens.expires_in) * 1000),
        refreshTokenExpiresAt: new Date(now + Number(tokens.refresh_expires_in) * 1000),
        scopes: tokens.scope || "",
        status: "CONNECTED",
        lastTokenRefreshAt: new Date(),
      },
    });
    return { shop: record.shop, connectionId: connection.id };
  } catch (error) {
    const safe = safeTikTokError(error);
    throw new Error(`${safe.message}${safe.logId ? ` Support-ID: ${safe.logId}` : ""}`);
  }
}
