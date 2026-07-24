import process from "node:process";
import { Buffer } from "node:buffer";
import test from "node:test";
import assert from "node:assert/strict";
import db from "../app/db.server.js";
import { encryptTikTokSecret, decryptTikTokSecret } from "../app/services/tiktok/tiktok-crypto.server.js";
import { hashOAuthState, statesMatch, tiktokConfiguration } from "../app/services/tiktok/tiktok-oauth.server.js";
import { getValidTikTokAccessToken } from "../app/services/tiktok/tiktok-token.server.js";
import { validateTikTokVideo } from "../app/services/tiktok/tiktok-media.server.js";
import { createTikTokPost, transitionTikTokStatus } from "../app/services/tiktok/tiktok-posts.server.js";
import { parseTikTokResponse, safeTikTokError } from "../app/services/tiktok/tiktok-errors.server.js";

const TEST_KEY = "tiktok-test-encryption-key-with-more-than-32-characters";

test("OAuth state wird gehasht und konstant verglichen", () => {
  assert.notEqual(hashOAuthState("state-a"), "state-a");
  assert.equal(statesMatch("state-a", "state-a"), true);
  assert.equal(statesMatch("state-a", "state-b"), false);
});

test("TikTok-Konfiguration verlangt die exakte Redirect URI", () => {
  const previous = process.env.TIKTOK_REDIRECT_URI;
  process.env.TIKTOK_REDIRECT_URI = "https://example.com/callback";
  try { assert.equal(tiktokConfiguration().redirectMatches, false); }
  finally { if (previous === undefined) delete process.env.TIKTOK_REDIRECT_URI; else process.env.TIKTOK_REDIRECT_URI = previous; }
});

test("TikTok-Tokens werden verschlüsselt", () => {
  const previous = process.env.TIKTOK_TOKEN_ENCRYPTION_KEY;
  process.env.TIKTOK_TOKEN_ENCRYPTION_KEY = TEST_KEY;
  try {
    const encrypted = encryptTikTokSecret("secret-token");
    assert.equal(encrypted.includes("secret-token"), false);
    assert.equal(decryptTikTokSecret(encrypted), "secret-token");
  } finally { if (previous === undefined) delete process.env.TIKTOK_TOKEN_ENCRYPTION_KEY; else process.env.TIKTOK_TOKEN_ENCRYPTION_KEY = previous; }
});

test("Token-Erneuerung rotiert Access- und Refresh-Token", async () => {
  const shop = `tiktok-refresh-${Date.now()}-${Math.random()}.myshopify.com`;
  const previous = { key: process.env.TIKTOK_TOKEN_ENCRYPTION_KEY, client: process.env.TIKTOK_CLIENT_KEY, secret: process.env.TIKTOK_CLIENT_SECRET };
  process.env.TIKTOK_TOKEN_ENCRYPTION_KEY = TEST_KEY;
  process.env.TIKTOK_CLIENT_KEY = "test-client";
  process.env.TIKTOK_CLIENT_SECRET = "test-secret";
  try {
    await db.tikTokConnection.create({ data: { shop, openId: "open", accessTokenEncrypted: encryptTikTokSecret("old-access"), refreshTokenEncrypted: encryptTikTokSecret("old-refresh"), accessTokenExpiresAt: new Date(Date.now() - 1000), refreshTokenExpiresAt: new Date(Date.now() + 86400000), scopes: "video.upload" } });
    const fetchImpl = async () => new Response(JSON.stringify({ access_token: "new-access", refresh_token: "new-refresh", expires_in: 86400, refresh_expires_in: 31536000, open_id: "open", scope: "video.upload", token_type: "Bearer" }), { status: 200, headers: { "Content-Type": "application/json" } });
    const result = await getValidTikTokAccessToken(shop, { fetchImpl });
    assert.equal(result.token, "new-access");
    const stored = await db.tikTokConnection.findUnique({ where: { shop } });
    assert.equal(decryptTikTokSecret(stored.refreshTokenEncrypted), "new-refresh");
  } finally {
    await db.tikTokConnection.deleteMany({ where: { shop } });
    for (const [name, value] of Object.entries({ TIKTOK_TOKEN_ENCRYPTION_KEY: previous.key, TIKTOK_CLIENT_KEY: previous.client, TIKTOK_CLIENT_SECRET: previous.secret })) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
  }
});

test("Fehlende Verbindung verhindert Post-Erstellung", async () => {
  await assert.rejects(() => createTikTokPost({ shop: `missing-${Date.now()}.myshopify.com`, assetId: 1, caption: "Test" }), /nicht verbunden/);
});

test("Upload-Fehler werden ohne vollständige TikTok-Antwort normalisiert", () => {
  const response = new Response(JSON.stringify({ error: { code: "rate_limit_exceeded", message: "sensitive details", log_id: "safe-log-1" } }), { status: 429 });
  assert.throws(() => parseTikTokResponse(response, { error: { code: "rate_limit_exceeded", message: "sensitive details", log_id: "safe-log-1" } }));
  const safe = safeTikTokError({ status: 429, code: "rate_limit_exceeded", logId: "safe-log-1" });
  assert.equal(safe.retryable, true);
  assert.equal(safe.message.includes("sensitive"), false);
});

test("Videotyp, Größe und Dauer werden validiert", () => {
  const fake = { type: "application/octet-stream", size: 200 * 1024 * 1024, arrayBuffer() {} };
  const errors = validateTikTokVideo(fake, Buffer.from("invalid"), { durationSeconds: 700 });
  assert.ok(errors.length >= 3);
});

test("TikTok-Statusübergänge sind begrenzt", () => {
  assert.equal(transitionTikTokStatus("DRAFT", "UPLOADING"), "UPLOADING");
  assert.equal(transitionTikTokStatus("UPLOADING", "UPLOADED"), "UPLOADED");
  assert.equal(transitionTikTokStatus("UPLOADED", "PUBLISHED"), "PUBLISHED");
  assert.throws(() => transitionTikTokStatus("PUBLISHED", "UPLOADING"), /Ungültiger/);
});
