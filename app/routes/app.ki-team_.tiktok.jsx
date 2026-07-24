import { Form, useActionData, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { AiTeamNav, cardStyle, gridStyle } from "../ai-team";
import { disconnectTikTok } from "../services/tiktok/tiktok-token.server";
import { refreshTikTokPostStatus } from "../services/tiktok/tiktok-posts.server";
import { createTikTokAuthorization, tiktokConfiguration, TIKTOK_SCOPES } from "../services/tiktok/tiktok-oauth.server";
import { TikTokUploadForm } from "../components/TikTokUploadForm";
import { handleTikTokUploadForm } from "../services/tiktok/tiktok-upload-action.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const [connection, posts] = await Promise.all([
    db.tikTokConnection.findUnique({
      where: { shop: session.shop },
      select: { id: true, username: true, displayName: true, avatarUrl: true, scopes: true, status: true, lastTokenRefreshAt: true },
    }),
    db.socialPost.findMany({ where: { shop: session.shop, platform: "TIKTOK" }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const configuration = tiktokConfiguration();
  const oauthStartUrl = !connection && configuration.configured ? await createTikTokAuthorization(session.shop) : null;
  return { connection, posts, oauthStartUrl, config: { configured: configuration.configured, redirectMatches: configuration.redirectMatches, environment: configuration.environment }, requiredScopes: TIKTOK_SCOPES };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    if (form.get("intent") === "upload") {
      const post = await handleTikTokUploadForm(session.shop, form);
      return { ok: true, message: post.status === "SCHEDULED" ? "TikTok-Entwurf wurde geplant." : "Video wurde als TikTok-Entwurf hochgeladen." };
    }
    if (form.get("intent") === "disconnect") {
      await disconnectTikTok(session.shop);
      return { ok: true, message: "TikTok-Verbindung wurde getrennt und die lokalen Tokens wurden entfernt." };
    }
    if (form.get("intent") === "refreshStatus") {
      const post = await db.socialPost.findFirst({ where: { id: Number(form.get("postId")), shop: session.shop, platform: "TIKTOK" } });
      if (!post) throw new Error("TikTok-Beitrag nicht gefunden.");
      await refreshTikTokPostStatus(post.id);
      return { ok: true, message: "TikTok-Status wurde einmalig aktualisiert." };
    }
    throw new Error("Aktion nicht erkannt.");
  } catch (error) {
    return { ok: false, error: String(error?.message || error) };
  }
};

export default function TikTok() {
  const { connection, posts, oauthStartUrl, config, requiredScopes } = useLoaderData();
  const data = useActionData();
  const granted = new Set(String(connection?.scopes || "").split(",").filter(Boolean));
  return <s-page heading="Marketing · Social Media · TikTok"><AiTeamNav/>
    {data?.message && <s-banner tone="success">{data.message}</s-banner>}
    {data?.error && <s-banner tone="critical">{data.error}</s-banner>}
    <s-section><div style={cardStyle}><h2>{connection ? "Verbunden" : "Nicht verbunden"}</h2>
      {connection ? <div style={{display:"flex", gap:16, alignItems:"center", flexWrap:"wrap"}}>
        {connection.avatarUrl && <img src={connection.avatarUrl} alt="TikTok-Profilbild" width="80" height="80" style={{borderRadius:"50%"}}/>}
        <p><strong>{connection.displayName || "CrunchLab TikTok"}</strong><br/>@{connection.username || "–"}<br/>Status: {connection.status}<br/>Letzte Token-Aktualisierung: {new Date(connection.lastTokenRefreshAt).toLocaleString("de-DE")}</p>
        <Form method="post" onSubmit={(event) => { if (!window.confirm("TikTok-Verbindung wirklich trennen?")) event.preventDefault(); }}><input type="hidden" name="intent" value="disconnect"/><button>Verbindung trennen</button></Form>
      </div> : config.configured ? <a href={oauthStartUrl} target="_blank" rel="noopener noreferrer" style={{display:"inline-block",padding:"10px 14px",borderRadius:8,background:"#202223",color:"white",fontWeight:700,textDecoration:"none"}}>TikTok verbinden</a> : <s-banner tone="info">TikTok OAuth ist vorbereitet. Zuerst müssen die sicheren Umgebungsvariablen gesetzt und die Redirect-Weiterleitung geprüft werden.</s-banner>}
      {!config.redirectMatches && <s-banner tone="critical">TIKTOK_REDIRECT_URI muss exakt https://crunch-lab.de/api/tiktok/callback sein.</s-banner>}
      <p>Umgebung: {config.environment} · Direct Post: deaktiviert bis TikTok-Freigabe</p></div></s-section>
    <s-section heading="Berechtigungen">{requiredScopes.map((scope) => <p key={scope}>{granted.has(scope) ? "✓" : "⚠"} <strong>{scope}</strong></p>)}<p>video.publish ist bewusst nicht Teil der Sandbox-Anforderung.</p></s-section>
    <s-section heading="TikTok-Entwurf erstellen">{connection ? <TikTokUploadForm/> : <p>Zuerst das CrunchLab-TikTok-Konto verbinden.</p>}</s-section>
    <s-section heading="Letzte TikTok-Beiträge"><div style={gridStyle}>{posts.map((post) => <article key={post.id} style={cardStyle}><h3>{post.title || `TikTok #${post.id}`}</h3><p>Status: <strong>{post.status}</strong><br/>Upload: {post.uploadProgress}%<br/>Geplant: {post.scheduledFor ? new Date(post.scheduledFor).toLocaleString("de-DE") : "sofort"}</p><p>{post.caption}</p>{post.errorMessage && <s-banner tone="critical">{post.errorMessage}</s-banner>}{post.externalPostId && <Form method="post"><input type="hidden" name="intent" value="refreshStatus"/><input type="hidden" name="postId" value={post.id}/><button>Status einmalig abrufen</button></Form>}</article>)}</div>{!posts.length && <p>Noch keine TikTok-Beiträge.</p>}</s-section>
    <s-section><s-banner tone="warning">Ein Upload erzeugt einen TikTok-Entwurf. Die Veröffentlichung wird anschließend in der TikTok-App abgeschlossen. Caption und Hashtags bleiben hier als redaktionelle Vorlage gespeichert.</s-banner></s-section>
  </s-page>;
}
