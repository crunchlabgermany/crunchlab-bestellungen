import { useActionData, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { AiTeamNav, cardStyle } from "../ai-team";
import { TikTokUploadForm } from "../components/TikTokUploadForm";
import { handleTikTokUploadForm } from "../services/tiktok/tiktok-upload-action.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  return { connection: await db.tikTokConnection.findUnique({ where: { shop: session.shop }, select: { username: true, displayName: true, avatarUrl: true, status: true } }) };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  try {
    const post = await handleTikTokUploadForm(session.shop, await request.formData());
    return { ok: true, message: `Upload gestartet. Interner Status: ${post.status}.` };
  } catch (error) {
    return { ok: false, error: String(error?.message || error) };
  }
};

export default function TikTokDemo() {
  const { connection } = useLoaderData();
  const data = useActionData();
  return <s-page heading="TikTok Demo"><AiTeamNav/>
    {data?.message && <s-banner tone="success">{data.message}</s-banner>}
    {data?.error && <s-banner tone="critical">{data.error}</s-banner>}
    <s-section><div style={cardStyle}><ol><li>TikTok verbinden</li><li>Verbundenes CrunchLab-Konto prüfen</li><li>Testvideo auswählen</li><li>Caption eingeben</li><li>Als Entwurf hochladen</li><li>TikTok-Status prüfen</li></ol></div></s-section>
    <s-section heading="Verbundenes Konto">{connection ? <p>{connection.avatarUrl && <img src={connection.avatarUrl} alt="TikTok-Profilbild" width="56" height="56" style={{borderRadius:"50%",verticalAlign:"middle",marginRight:12}}/>}<strong>{connection.displayName}</strong> @{connection.username}</p> : <s-banner tone="warning">Noch nicht verbunden. Beginne im TikTok-Bereich mit „TikTok verbinden“.</s-banner>}</s-section>
    <s-section heading="Sandbox-Testupload">{connection ? <TikTokUploadForm demo/> : <p>Upload bleibt bis zur Verbindung gesperrt.</p>}</s-section>
    <s-section><s-banner tone="info">Nach dem Upload sendet TikTok eine Inbox-Benachrichtigung. Öffne sie in TikTok, bearbeite den Entwurf bei Bedarf und schließe die Veröffentlichung dort ab.</s-banner></s-section>
  </s-page>;
}
