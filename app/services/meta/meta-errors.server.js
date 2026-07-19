export function safeMetaError(error) {
  const message=String(error?.message||error||"Unbekannter Meta-Fehler");
  return message.replace(/(?:access_token|token|secret|code)=[^&\s]+/gi,"$1=[REDACTED]").slice(0,500);
}
