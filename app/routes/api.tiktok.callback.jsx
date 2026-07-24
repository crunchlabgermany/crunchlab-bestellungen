import process from "node:process";
import { redirect } from "react-router";
import { completeTikTokOAuth } from "../services/tiktok/tiktok-oauth.server";

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const oauthError = url.searchParams.get("error_description") || url.searchParams.get("error");
  if (oauthError) throw new Response("TikTok-Autorisierung wurde abgebrochen oder abgelehnt.", { status: 400 });
  if (!state || !code) throw new Response("TikTok-Autorisierung ist unvollständig.", { status: 400 });
  const result = await completeTikTokOAuth({ state, code });
  const appUrl = process.env.SHOPIFY_APP_URL;
  if (!appUrl) throw new Response("SHOPIFY_APP_URL fehlt.", { status: 500 });
  return redirect(`${appUrl}/app/ki-team/tiktok?shop=${encodeURIComponent(result.shop)}&connected=1`);
};
