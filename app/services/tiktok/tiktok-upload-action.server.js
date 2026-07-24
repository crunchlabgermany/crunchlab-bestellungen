import { Buffer } from "node:buffer";
import db from "../../db.server.js";
import { validateTikTokVideo } from "./tiktok-media.server.js";
import { createTikTokPost } from "./tiktok-posts.server.js";

export async function handleTikTokUploadForm(shop, form) {
  const file = form.get("video");
  if (!file || typeof file.arrayBuffer !== "function") throw new Error("Bitte ein Video auswählen.");
  const buffer = Buffer.from(await file.arrayBuffer());
  const durationInput = Number(form.get("durationSeconds"));
  const errors = validateTikTokVideo(file, buffer, { durationSeconds: Number.isFinite(durationInput) && durationInput > 0 ? durationInput : undefined });
  if (errors.length) throw new Error(errors.join(" "));
  const asset = await db.socialMediaAsset.create({
    data: {
      shop,
      fileName: file.name,
      originalName: file.name,
      title: "TikTok-Video",
      mimeType: file.type,
      fileType: "VIDEO",
      storageUrl: "internal",
      fileSize: file.size,
      blob: { create: { data: buffer } },
    },
  });
  try {
    return await createTikTokPost({
      shop,
      assetId: asset.id,
      caption: form.get("caption"),
      hashtags: form.get("hashtags"),
      scheduledAt: form.get("scheduledAt") || null,
    });
  } catch (error) {
    const used = await db.socialPostAsset.count({ where: { assetId: asset.id } });
    if (!used) await db.socialMediaAsset.delete({ where: { id: asset.id } });
    throw error;
  }
}
