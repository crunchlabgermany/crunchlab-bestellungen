import db from "../../db.server.js";
import { AGENT_DEFINITIONS } from "./agent-prompts.server.js";

export async function ensureAiTeam(shop) {
  for (const definition of AGENT_DEFINITIONS) {
    await db.aiAgent.upsert({
      where: { shop_slug: { shop, slug: definition.slug } },
      create: { shop, slug: definition.slug, name: definition.name, role: definition.role, description: definition.description, goals: JSON.stringify(definition.goals), instructions: definition.instructions },
      update: { name: definition.name, role: definition.role, description: definition.description, goals: JSON.stringify(definition.goals), instructions: definition.instructions },
    });
  }
  await db.aiSettings.upsert({ where: { shop }, create: { shop }, update: {} });
}

export async function getAgent(shop, slug) {
  await ensureAiTeam(shop);
  return db.aiAgent.findUnique({ where: { shop_slug: { shop, slug } } });
}

export function getDefinition(slug) { return AGENT_DEFINITIONS.find((agent) => agent.slug === slug); }
