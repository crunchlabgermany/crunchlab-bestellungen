export function safeTikTokError(error) {
  const status = Number(error?.status || 0);
  const code = String(error?.code || "tiktok_error").replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 80);
  const logId = String(error?.logId || "").replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 120);
  const retryable = status === 429 || status >= 500;
  const message = retryable
    ? "TikTok ist vorübergehend ausgelastet. Der Versuch kann später wiederholt werden."
    : "TikTok hat die Anfrage abgelehnt. Bitte Verbindung, Berechtigungen und Videodatei prüfen.";
  return { code, logId: logId || null, retryable, message };
}

export function parseTikTokResponse(response, body) {
  const apiError = body?.error;
  if (!response.ok || (apiError && apiError.code && apiError.code !== "ok")) {
    const error = new Error("TikTok API request failed");
    error.status = response.status;
    error.code = apiError?.code || body?.error || `http_${response.status}`;
    error.logId = apiError?.log_id || body?.log_id || null;
    throw error;
  }
  return body;
}
