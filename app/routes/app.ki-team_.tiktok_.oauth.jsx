import { redirect } from "react-router";
import { authenticate } from "../shopify.server";
import { createTikTokAuthorization } from "../services/tiktok/tiktok-oauth.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  return redirect(await createTikTokAuthorization(session.shop));
};
