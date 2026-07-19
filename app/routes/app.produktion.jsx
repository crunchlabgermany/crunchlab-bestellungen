import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const statuses = ["RELEASED", "IN_PRODUCTION", "PACKED", "LABEL_CREATED", "READY_TO_SHIP"];
  const [orders, ingredients, movements] = await Promise.all([
    db.order.findMany({ where: { shop: session.shop, productionStatus: { in: statuses } }, include: { ingredients: true }, orderBy: { createdAtShopify: "asc" } }),
    db.ingredient.findMany({ where: { shop: session.shop, active: true }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
    db.stockMovement.groupBy({ by: ["ingredientId"], where: { shop: session.shop, type: "RESERVATION" }, _sum: { quantityGrams: true } }),
  ]);
  const needs = new Map();
  for (const order of orders.filter((item) => ["RELEASED", "IN_PRODUCTION"].includes(item.productionStatus))) {
    for (const item of order.ingredients) if (item.ingredientId) needs.set(item.ingredientId, (needs.get(item.ingredientId) || 0) + Number(item.totalGrams || 0));
  }
  const reserved = new Map(movements.map((item) => [item.ingredientId, Math.abs(Number(item._sum.quantityGrams || 0))]));
  return { orders, rows: ingredients.map((item) => ({ ...item, needed: needs.get(item.id) || 0, reserved: reserved.get(item.id) || 0 })) };
};

export default function Produktion() {
  const { orders, rows } = useLoaderData();
  const total = orders.reduce((sum, order) => sum + order.totalWeight, 0);
  const cards = [["Offene Bestellungen", orders.length], ["Mischungen", orders.length], ["Gesamtgewicht", `${total.toLocaleString("de-DE")} g`], ["Versandbereit", orders.filter((order) => order.productionStatus === "READY_TO_SHIP").length]];
  return <s-page heading="Tagesproduktion"><s-button slot="primary-action" onClick={() => window.print()}>Tagesliste drucken</s-button><s-section><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>{cards.map(([label, value]) => <div key={label} style={{ padding: 16, border: "1px solid #ddd", borderRadius: 12 }}><small>{label}</small><div style={{ fontSize: 24, fontWeight: 700 }}>{value}</div></div>)}</div></s-section><s-section heading="Tagesbedarf je Zutat"><div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr>{["Gruppe", "Zutat", "Bestand", "Reserviert", "Verfügbar", "Benötigt", "Fehlmenge"].map((heading) => <th key={heading} style={{ padding: 9, textAlign: "left", borderBottom: "1px solid #ddd" }}>{heading}</th>)}</tr></thead><tbody>{rows.filter((row) => row.needed > 0 || row.stockWeight <= row.minimumStock).map((row) => { const available = row.stockWeight - row.reserved; const missing = Math.max(row.needed - available, 0); return <tr key={row.id}><td style={cell}>{row.category}</td><td style={cell}>{row.name}</td><td style={cell}>{row.stockWeight.toLocaleString("de-DE")} g</td><td style={cell}>{row.reserved.toLocaleString("de-DE")} g</td><td style={cell}>{available.toLocaleString("de-DE")} g</td><td style={cell}>{row.needed.toLocaleString("de-DE")} g</td><td style={{ ...cell, color: missing ? "#b42318" : undefined, fontWeight: missing ? 700 : undefined }}>{missing.toLocaleString("de-DE")} g</td></tr>; })}</tbody></table></div></s-section></s-page>;
}
const cell = { padding: 9, borderBottom: "1px solid #eee" };
export const headers = (args) => boundary.headers(args);
