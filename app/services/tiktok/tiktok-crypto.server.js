import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function encryptionKey() {
  const value = process.env.TIKTOK_TOKEN_ENCRYPTION_KEY;
  if (!value || value.length < 32) {
    throw new Error("Die TikTok-Tokenverschlüsselung benötigt einen geheimen Schlüssel mit mindestens 32 Zeichen.");
  }
  return createHash("sha256").update(value).digest();
}

export function encryptTikTokSecret(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return JSON.stringify({
    v: 1,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: ciphertext.toString("base64"),
  });
}

export function decryptTikTokSecret(serialized) {
  const payload = JSON.parse(serialized);
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(payload.iv, "base64"));
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(payload.data, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
