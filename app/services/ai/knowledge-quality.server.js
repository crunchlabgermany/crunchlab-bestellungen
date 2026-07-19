import db from "../../db.server.js";

export function validateKnowledgeDraft(input) {
  const errors=[];
  if(!input.title||input.title.length<5)errors.push("Der Titel ist zu kurz.");
  if(!input.summary||input.summary.length<80)errors.push("Die eigene Zusammenfassung muss mindestens 80 Zeichen enthalten.");
  if(input.summary?.length>4000)errors.push("Die Zusammenfassung ist zu lang; vollständige Artikel dürfen nicht gespeichert werden.");
  if(!input.domain)errors.push("Das Fachgebiet fehlt.");
  if(!input.tags)errors.push("Mindestens ein Tag ist erforderlich.");
  if(input.confidenceScore<60||input.relevanceScore<60)errors.push("Vertrauen und Relevanz müssen mindestens 60 von 100 erreichen.");
  if(!input.credible||!input.current||!input.traceable||!input.relevant||!input.nonContradictory)errors.push("Alle fünf Qualitätskriterien müssen bestätigt sein.");
  return errors;
}

export async function storeReviewedKnowledge({shop,agentId,sourceId,input,reviewedBy}) {
  const source=await db.knowledgeSource.findFirst({where:{id:sourceId,shop,agentId,active:true,freeAccess:true}});
  if(!source)throw new Error("Es ist keine aktive, kostenlose und zum Agenten gehörende Quelle ausgewählt.");
  const errors=validateKnowledgeDraft(input);if(errors.length)throw new Error(errors.join(" "));
  const latest=await db.knowledgeEntry.findFirst({where:{shop,agentId,title:input.title},orderBy:{version:"desc"}});
  return db.$transaction(async transaction=>{
    if(latest)await transaction.knowledgeEntry.update({where:{id:latest.id},data:{status:"SUPERSEDED"}});
    const entry=await transaction.knowledgeEntry.create({data:{shop,agentId,sourceId,title:input.title,summary:input.summary,domain:input.domain,sourceUrl:source.url,sourceDate:input.sourceDate||null,confidenceScore:input.confidenceScore,relevanceScore:input.relevanceScore,version:(latest?.version||0)+1,tags:input.tags,status:input.uncertainty?"UNCERTAIN":"CURRENT",uncertainty:input.uncertainty||null,verifiedAt:new Date()}});
    await transaction.knowledgeReview.create({data:{shop,entryId:entry.id,credible:true,current:true,traceable:true,relevant:true,nonContradictory:true,verdict:"ACCEPTED",notes:input.reviewNotes||null,reviewedBy:reviewedBy||null}});
    await transaction.aiActivityLog.create({data:{shop,agentId,action:"KNOWLEDGE_ACCEPTED",details:`${entry.title} · Version ${entry.version}`}});
    return entry;
  });
}
