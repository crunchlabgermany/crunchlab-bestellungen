import db from "../../db.server.js";
import { decryptTikTokSecret, encryptTikTokSecret } from "./tiktok-crypto.server.js";
import { parseTikTokResponse, safeTikTokError } from "./tiktok-errors.server.js";

export async function getValidTikTokAccessToken(shop, { forceRefresh = false, fetchImpl = fetch } = {}) {
  const connection = await db.tikTokConnection.findUnique({ where: { shop } });
  if (!connection || connection.status !== "CONNECTED") throw new Error("TikTok ist nicht verbunden.");
  if (connection.refreshTokenExpiresAt <= new Date()) throw new Error("Die TikTok-Verbindung ist abgelaufen und muss neu autorisiert werden.");
  if (!forceRefresh && connection.accessTokenExpiresAt.getTime() > Date.now() + 10 * 60 * 1000) {
    return { token: decryptTikTokSecret(connection.accessTokenEncrypted), connection };
  }
  const body = new URLSearchParams({
    client_key: process.env.TIKTOK_CLIENT_KEY,
    client_secret: process.env.TIKTOK_CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token: decryptTikTokSecret(connection.refreshTokenEncrypted),
  });
  try {
    const response = await fetchImpl("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" },
      body,
    });
    const tokens = parseTikTokResponse(response, await response.json());
    const updated = await db.tikTokConnection.update({
      where: { shop },
      data: {
        openId: tokens.open_id || connection.openId,
        accessTokenEncrypted: encryptTikTokSecret(tokens.access_token),
        refreshTokenEncrypted: encryptTikTokSecret(tokens.refresh_token),
        accessTokenExpiresAt: new Date(Date.now() + Number(tokens.expires_in) * 1000),
        refreshTokenExpiresAt: new Date(Date.now() + Number(tokens.refresh_expires_in) * 1000),
        scopes: tokens.scope || connection.scopes,
        lastTokenRefreshAt: new Date(),
      },
    });
    return { token: tokens.access_token, connection: updated };
  } catch (error) {
    const safe = safeTikTokError(error);
    throw new Error(`${safe.message}${safe.logId ? ` Support-ID: ${safe.logId}` : ""}`);
  }
}

export async function disconnectTikTok(shop, { fetchImpl = fetch } = {}) {
  const connection = await db.tikTokConnection.findUnique({ where: { shop } });
  if (!connection) return;
  try {
    const body = new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY || "",
      client_secret: process.env.TIKTOK_CLIENT_SECRET || "",
      token: decryptTikTokSecret(connection.accessTokenEncrypted),
    });
    await fetchImpl("https://open.tiktokapis.com/v2/oauth/revoke/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
  } catch {
    // Local revocation still removes all usable credentials; no secrets are logged.
  }
  await db.tikTokConnection.delete({ where: { shop } });
}
