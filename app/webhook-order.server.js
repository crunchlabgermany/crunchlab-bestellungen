import { cancelOrderReservations, recordWebhook, syncShopifyOrders } from "./order-workflow.server";

function gid(type, id) { return String(id).startsWith("gid://") ? String(id) : `gid://shopify/${type}/${id}`; }
export function webhookOrderToGraphql(payload) {
  return {
    id: gid("Order", payload.admin_graphql_api_id || payload.id), name: payload.name || `#${payload.order_number}`,
    createdAt: payload.created_at || new Date().toISOString(), displayFinancialStatus: String(payload.financial_status || "").toUpperCase(),
    displayFulfillmentStatus: String(payload.fulfillment_status || "UNFULFILLED").toUpperCase(),
    totalPriceSet: { shopMoney: { amount: payload.current_total_price || payload.total_price || "0", currencyCode: payload.currency || "EUR" } },
    lineItems: { nodes: (payload.line_items || []).map((line) => ({ id: gid("LineItem", line.admin_graphql_api_id || line.id), name: line.name, title: line.title, quantity: line.quantity, originalUnitPriceSet: { shopMoney: { amount: line.price || "0", currencyCode: payload.currency || "EUR" } }, customAttributes: (line.properties || []).map((property) => ({ key: property.name, value: String(property.value || "") })) })) },
  };
}

export async function handleOrderWebhook({ shop, webhookId, topic, payload }) {
  return recordWebhook({ shop, webhookId, topic, handler: async () => {
    await syncShopifyOrders(shop, [webhookOrderToGraphql(payload)]);
    if (topic === "ORDERS_CANCELLED") await cancelOrderReservations(shop, gid("Order", payload.admin_graphql_api_id || payload.id));
  }});
}
