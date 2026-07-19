import { authenticate } from "../shopify.server"; import { recordWebhook } from "../order-workflow.server";
export const action=async({request})=>{const{shop,topic,webhookId,payload}=await authenticate.webhook(request);await recordWebhook({shop,topic,webhookId:webhookId||request.headers.get("x-shopify-webhook-id")||`${topic}:${payload.id}`,handler:async()=>{}});return new Response()};
