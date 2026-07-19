import db from "../../db.server.js";
export async function getUsageSummary(shop) {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const [tasksToday, aggregate] = await Promise.all([
    db.aiTask.count({ where: { shop, createdAt: { gte: start } } }),
    db.aiResult.aggregate({ where: { shop, createdAt: { gte: start } }, _sum: { tokenUsage: true, estimatedCost: true } }),
  ]);
  return { tasksToday, tokenUsage: aggregate._sum.tokenUsage || 0, estimatedCost: Number(aggregate._sum.estimatedCost || 0) };
}
