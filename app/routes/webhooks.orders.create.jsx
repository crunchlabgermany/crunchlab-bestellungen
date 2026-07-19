import { authenticate } from "../shopify.server"; import { handleOrderWebhook } from "../webhook-order.server";
export const action=async({request})=>{const{shop,topic,webhookId,payload}=await authenticate.webhook(request);await handleOrderWebhook({shop,topic,webhookId:webhookId||request.headers.get("x-shopify-webhook-id")||`${topic}:${payload.id}`,payload});return new Response()};
