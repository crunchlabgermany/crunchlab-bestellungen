import db from "../../db.server.js";

export async function decideResult({ shop, resultId, decision, user, rejectionReason }) {
  const result = await db.aiResult.findFirst({ where: { id: resultId, shop }, include: { task: true } });
  if (!result || result.task.shop !== shop) throw new Error("Ergebnis nicht gefunden.");
  if (!['APPROVED', 'REJECTED'].includes(decision)) throw new Error("Ungültige Freigabeentscheidung.");
  return db.$transaction(async (transaction) => {
    const approval = await transaction.aiApproval.upsert({
      where: { shop_resultId_actionType: { shop, resultId, actionType: "CONTENT_REVIEW" } },
      create: { shop, taskId: result.taskId, resultId, actionType: "CONTENT_REVIEW", status: decision, approvedBy: user || null, approvedAt: decision === "APPROVED" ? new Date() : null, rejectionReason: decision === "REJECTED" ? rejectionReason || "Ohne Begründung" : null },
      update: { status: decision, approvedBy: user || null, approvedAt: decision === "APPROVED" ? new Date() : null, rejectionReason: decision === "REJECTED" ? rejectionReason || "Ohne Begründung" : null },
    });
    await transaction.aiResult.update({ where: { id: resultId }, data: { status: decision } });
    await transaction.aiTask.update({ where: { id: result.taskId }, data: { status: decision === "APPROVED" ? "APPROVED" : "REJECTED" } });
    await transaction.aiActivityLog.create({ data: { shop, agentId: result.task.agentId, taskId: result.taskId, action: `RESULT_${decision}`, details: decision === "REJECTED" ? rejectionReason || null : null } });
    return approval;
  });
}
