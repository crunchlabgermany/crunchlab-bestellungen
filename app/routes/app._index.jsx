import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const [orders, ingredients, failedWebhooks] = await Promise.all([
    db.order.findMany({ where: { shop: session.shop }, include: { ingredients: true } }),
    db.ingredient.findMany({ where: { shop: session.shop, active: true }, select: { stockWeight: true, minimumStock: true } }),
    db.webhookEvent.count({ where: { shop: session.shop, status: "FAILED" } }),
  ]);
  const today = orders.filter((order) => order.createdAtShopify >= start);
  const count = (status) => orders.filter((order) => order.productionStatus === status).length;
  return { metrics: {
    newOrders: count("NEW"), review: count("CHECKED"), production: count("IN_PRODUCTION"), packed: count("PACKED"), ready: count("READY_TO_SHIP"), blocked: count("BLOCKED"),
    today: today.length, revenue: today.reduce((sum, order) => sum + order.totalPriceCents, 0),
    contribution: today.reduce((sum, order) => sum + order.totalPriceCents - order.ingredients.reduce((cost, item) => cost + Number(item.costCents || 0), 0), 0),
    unknown: orders.reduce((sum, order) => sum + order.ingredients.filter((item) => item.mappingStatus !== "MATCHED").length, 0), lowStock: ingredients.filter((item) => item.stockWeight <= item.minimumStock).length, failedWebhooks,
  }};
};

const euro = (cents) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);
export default function Dashboard() {
  const { metrics } = useLoaderData();
  const cards = [["Neue Bestellungen",metrics.newOrders],["Zu prüfen",metrics.review],["In Produktion",metrics.production],["Abgepackt",metrics.packed],["Versandbereit",metrics.ready],["Blockiert",metrics.blocked],["Bestellungen heute",metrics.today],["Umsatz heute",euro(metrics.revenue)],["Deckungsbeitrag auf Zutatenbasis heute",euro(metrics.contribution)],["Zutaten unter Mindestbestand",metrics.lowStock],["Nicht erkannte Konfigurationen",metrics.unknown],["Fehlgeschlagene Automatisierungen",metrics.failedWebhooks]];
  return <s-page heading="CrunchLab Dashboard"><s-section><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:12}}>{cards.map(([label,value])=><div key={label} style={{padding:16,border:"1px solid #dedede",borderRadius:12,background:"white"}}><p style={{margin:0,color:"#616161"}}>{label}</p><strong style={{fontSize:26}}>{value}</strong></div>)}</div></s-section><s-section heading="Schnellzugriffe"><div style={{display:"flex",gap:10,flexWrap:"wrap"}}><s-button href="/app/bestellungen">Nächste Bestellung bearbeiten</s-button><s-button href="/app/produktion">Tagesproduktion öffnen</s-button><s-button href="/app/versand">Versandetiketten erstellen</s-button><s-button href="/app/lager">Fehlbestände anzeigen</s-button></div></s-section></s-page>;
}
export const headers = (args) => boundary.headers(args);
