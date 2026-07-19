export function getOpenAiConnectionStatus() {
  // eslint-disable-next-line no-undef
  return { configured: Boolean(process.env.OPENAI_API_KEY), phase: 1 };
}

export async function runAgentTask() {
  return { executed: false, reason: "Die automatische OpenAI-Ausführung ist in Phase 1 deaktiviert." };
}
