import process from "node:process";
import { runTikTokScheduledPosts } from "../app/services/tiktok/tiktok-posts.server.js";
import db from "../app/db.server.js";

try {
  const results = await runTikTokScheduledPosts({ limit: 5 });
  const succeeded = results.filter((item) => item.ok).length;
  const failed = results.length - succeeded;
  console.log(`TikTok-Worker abgeschlossen: ${succeeded} erfolgreich, ${failed} fehlgeschlagen.`);
  process.exitCode = failed ? 1 : 0;
} catch {
  console.error("TikTok-Worker konnte nicht sicher ausgeführt werden.");
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
