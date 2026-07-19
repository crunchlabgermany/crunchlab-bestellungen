import { Form, useActionData, useLoaderData, useNavigation, useSearchParams } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";
/* eslint-disable react/prop-types */
import { calculateReview, PRODUCTION_STATUSES } from "../order-workflow";
import { syncShopifyOrders, transitionOrder } from "../order-workflow.server";

const ORDER_QUERY = `#graphql
  query CrunchLabBestellungen($after: String) {
    orders(first: 50, after: $after, sortKey: CREATED_AT, reverse: true) {
      nodes { id name createdAt displayFinancialStatus displayFulfillmentStatus
        totalPriceSet { shopMoney { amount currencyCode } }
        lineItems(first: 100) { nodes { id name title quantity originalUnitPriceSet { shopMoney { amount currencyCode } } customAttributes { key value } } }
      }
      pageInfo { hasNextPage endCursor }
    }
  }`;

async function fetchOrders(admin, limit = 100) {
  const orders = [];
  let after = null;
  do {
    const response = await admin.graphql(ORDER_QUERY, { variables: { after } });
    const json = await response.json();
    if (json.errors) throw new Error(json.errors.map((error) => error.message).join(", "));
    orders.push(...json.data.orders.nodes);
    after = json.data.orders.pageInfo.hasNextPage && orders.length < limit ? json.data.orders.pageInfo.endCursor : null;
  } while (after);
  return orders.slice(0, limit);
}

const orderInclude = {
  lineItems: { include: { ingredients: { include: { ingredient: true } } } },
  ingredients: { include: { ingredient: true } },
  statusHistory: { orderBy: { createdAt: "desc" }, take: 20 },
  stockMovements: true,
};

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const sourceOrders = await fetchOrders(admin);
  await syncShopifyOrders(session.shop, sourceOrders);
  const orders = await db.order.findMany({ where: { shop: session.shop }, orderBy: [{ priority: "desc" }, { createdAtShopify: "asc" }], include: orderInclude });
  return { orders: orders.map((order) => ({ ...order, review: calculateReview(order) })), shop: session.shop, customerDataAllowed: false };
};

function text(formData, key) { return String(formData.get(key) || "").trim(); }

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = text(formData, "intent");
  const orderId = Number(formData.get("orderId"));
  try {
    if (!Number.isInteger(orderId)) throw new Error("Bestellung nicht gefunden.");
    if (intent === "transition") {
      let targetStatus = text(formData, "targetStatus");
      let note = text(formData, "note") || null;
      if (targetStatus === "CHECKED") {
        const order = await db.order.findFirst({ where: { id: orderId, shop: session.shop }, include: { ingredients: { include: { ingredient: true } }, lineItems: true } });
        const review = order && calculateReview(order);
        if (review?.blockingReasons.length) { targetStatus = "BLOCKED"; note = review.blockingReasons.join("; "); }
      }
      await transitionOrder({ shop: session.shop, orderId, targetStatus, note, actor: session.email || null });
      return { ok: true, orderId, message: "Der Produktionsstatus wurde gespeichert." };
    }
    if (intent === "note") {
      await db.order.updateMany({ where: { id: orderId, shop: session.shop }, data: { internalNote: text(formData, "internalNote") || null } });
      return { ok: true, orderId, message: "Die interne Notiz wurde gespeichert." };
    }
    if (intent === "checkIngredient") {
      const ingredientId = Number(formData.get("orderIngredientId"));
      const ingredient = await db.orderIngredient.findFirst({ where: { id: ingredientId, orderId, order: { shop: session.shop } } });
      if (!ingredient) throw new Error("Zutat nicht gefunden.");
      await db.orderIngredient.update({ where: { id: ingredient.id }, data: { checked: !ingredient.checked } });
      return { ok: true, orderId };
    }
    throw new Error("Aktion nicht erkannt.");
  } catch (error) {
    return { ok: false, orderId, error: String(error?.message || error) };
  }
};

const STATUS_LABELS = { NEW: "Neu", CHECKED: "Geprüft", RELEASED: "Freigegeben", IN_PRODUCTION: "In Produktion", PACKED: "Abgepackt", LABEL_CREATED: "Etikett erstellt", READY_TO_SHIP: "Versandbereit", SHIPPED: "Versendet", COMPLETED: "Abgeschlossen", BLOCKED: "Blockiert" };
const NEXT_ACTIONS = {
  NEW: ["CHECKED", "Bestellung prüfen"], CHECKED: ["RELEASED", "Zur Produktion freigeben"], RELEASED: ["IN_PRODUCTION", "Produktion starten"],
  IN_PRODUCTION: ["PACKED", "Als abgepackt markieren"], LABEL_CREATED: ["READY_TO_SHIP", "Als versandbereit markieren"],
  READY_TO_SHIP: ["SHIPPED", "Als versendet markieren"], SHIPPED: ["COMPLETED", "Bestellung abschließen"],
};

function money(cents, currency = "EUR") { return new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(Number(cents || 0) / 100); }
function date(value) { const d = new Date(value); return `${d.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })}, ${d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" })}`; }
function shopifyAdminUrl(shop, gid) { return `https://admin.shopify.com/store/${shop.replace(".myshopify.com", "")}/orders/${String(gid).split("/").pop()}`; }

function StatusStepper({ status }) {
  return <div style={stepperStyle}>{PRODUCTION_STATUSES.map((step, index) => {
    const current = PRODUCTION_STATUSES.indexOf(status);
    return <div key={step} style={{ ...stepStyle, background: index < current ? "#dff5e5" : index === current ? "#202223" : "#f1f2f3", color: index === current ? "white" : "#303030" }}><span>{index + 1}</span>{STATUS_LABELS[step]}</div>;
  })}</div>;
}

function IngredientGroup({ title, items, orderId }) {
  const sum = items.reduce((total, item) => total + Number(item.totalGrams || 0), 0);
  return <section style={groupStyle}><h3 style={{ marginTop: 0 }}>{title}</h3>{items.length ? items.map((item) => <Form method="post" key={item.id} style={ingredientStyle}>
    <input type="hidden" name="intent" value="checkIngredient"/><input type="hidden" name="orderId" value={orderId}/><input type="hidden" name="orderIngredientId" value={item.id}/>
    <input aria-label={`${item.name} abgewogen`} type="checkbox" checked={item.checked} onChange={(event) => event.currentTarget.form.requestSubmit()}/>
    <strong style={{ fontSize: 20 }}>{item.totalGrams === null ? "?" : item.totalGrams.toLocaleString("de-DE")} g</strong>
    <span>{item.name}</span>{item.mappingStatus !== "MATCHED" && <span style={warningStyle}>Nicht erkannt</span>}
  </Form>) : <p>Keine Zutaten erkannt.</p>}<p><strong>Summe {title}:</strong> {sum.toLocaleString("de-DE")} g</p></section>;
}

function OrderDetail({ order, shop, customerDataAllowed }) {
  const actionData = useActionData();
  const navigation = useNavigation();
  const bases = order.ingredients.filter((item) => item.category.toLowerCase() === "basis");
  const toppings = order.ingredients.filter((item) => item.category.toLowerCase() === "topping");
  const next = NEXT_ACTIONS[order.productionStatus];
  const previousIndex = PRODUCTION_STATUSES.indexOf(order.productionStatus) - 1;
  const costs = order.ingredients.reduce((sum, item) => sum + Number(item.costCents || 0), 0);
  const contribution = order.totalPriceCents - costs;
  const mixtures = order.lineItems.reduce((sum, item) => sum + item.quantity, 0);
  return <div>
    {actionData?.orderId === order.id && actionData?.message && <s-banner tone="success">{actionData.message}</s-banner>}
    {actionData?.orderId === order.id && actionData?.error && <s-banner tone="critical">{actionData.error}</s-banner>}
    <div style={headerStyle}><div><h1 style={{ margin: 0 }}>{order.orderName}</h1><p>{date(order.createdAtShopify)} · {mixtures} Mischung(en) · <strong>{order.totalWeight.toLocaleString("de-DE")} g</strong></p></div><div><span style={badgeStyle}>{STATUS_LABELS[order.productionStatus]}</span> <span style={badgeStyle}>{order.paymentStatus || "Zahlung unbekannt"}</span></div></div>
    <StatusStepper status={order.productionStatus}/>
    {order.blockedReason && <s-banner tone="critical">Blockiert: {order.blockedReason}</s-banner>}
    <div style={summaryGridStyle}>
      <div style={cardStyle}><h3>Kundendaten</h3>{customerDataAllowed ? <p>{order.customerName}<br/>{order.customerEmail}<br/>{order.customerPhone}</p> : <p>Kundendaten sind für diese App noch nicht freigegeben.</p>}</div>
      <div style={cardStyle}><h3>Bestellung</h3><p>Zahlung: {order.paymentStatus || "Unbekannt"}<br/>Shopify-Versand: {order.fulfillmentStatus || "Unbekannt"}<br/>Priorität: {order.priority || "Normal"}</p></div>
    </div>
    {order.productionStatus === "CHECKED" && <div style={cardStyle}><h3>Prüfliste</h3><p>{order.review.paid ? "✓" : "⚠"} Bestellung bezahlt</p><p>{Math.abs(order.review.difference) < .01 ? "✓" : "⚠"} Sollgewicht {order.review.expected.toLocaleString("de-DE")} g (Differenz {order.review.difference.toLocaleString("de-DE")} g)</p><p>{order.review.unknown.length ? "⚠" : "✓"} Alle Zutaten und Mengen erkannt</p><p>{order.review.short.length ? "⚠ Fehlbestand: " + order.review.short.map((item) => item.name).join(", ") : "✓ Lagerbestand ausreichend"}</p></div>}
    {order.lineItems.map((line, index) => <div key={line.id} style={mixStyle}><h2>Mischung {index + 1} von {order.lineItems.length}: {line.title} {line.quantity > 1 && `(× ${line.quantity})`}</h2><div style={ingredientGridStyle}><IngredientGroup title="Basis" items={line.ingredients.filter((item) => item.category.toLowerCase() === "basis")} orderId={order.id}/><IngredientGroup title="Toppings" items={line.ingredients.filter((item) => item.category.toLowerCase() === "topping")} orderId={order.id}/></div></div>)}
    <div style={weightStyle}><span>Basis: {bases.reduce((s,i)=>s+Number(i.totalGrams||0),0).toLocaleString("de-DE")} g</span><span>Toppings: {toppings.reduce((s,i)=>s+Number(i.totalGrams||0),0).toLocaleString("de-DE")} g</span><strong>Gesamt: {order.review.total.toLocaleString("de-DE")} g</strong><span style={Math.abs(order.review.difference) < .01 ? successStyle : warningStyle}>Soll {order.review.expected.toLocaleString("de-DE")} g · Differenz {order.review.difference.toLocaleString("de-DE")} g</span></div>
    <section style={cardStyle}><h3>Versand</h3><p>Versandart: {order.shippingMethod || "In Shopify prüfen"}<br/>Fulfillmentstatus: {order.fulfillmentStatus || "Unbekannt"}<br/>Tracking: {order.trackingNumber || "Noch nicht vorhanden"}<br/>Etikett: {order.labelStatus === "CREATED" ? "Erstellt" : "Nicht bestätigt"}</p><a href={shopifyAdminUrl(shop, order.shopifyOrderId)} target="_top" style={buttonLinkStyle}>Versandetikett in Shopify erstellen</a><p style={{ color: "#616161" }}>Nach der Erstellung diese Seite neu laden. Die App markiert kein Etikett ohne bestätigte Versanddaten als erstellt.</p></section>
    <details style={cardStyle}><summary><strong>Kalkulation anzeigen</strong></summary>{order.review.unknown.length > 0 && <p style={warningStyle}>Die Kalkulation ist wegen nicht erkannter Zutaten unvollständig.</p>}<p>Verkaufspreis: {money(order.totalPriceCents, order.currencyCode)}<br/>Erkannte Zutatenkosten: {money(costs, order.currencyCode)}<br/>Deckungsbeitrag auf Zutatenbasis: {money(contribution, order.currencyCode)} ({order.totalPriceCents ? (contribution/order.totalPriceCents*100).toLocaleString("de-DE", { maximumFractionDigits: 1 }) : 0} %)</p></details>
    <div style={actionsStyle}>
      {next && order.productionStatus !== "PACKED" && <Form method="post"><input type="hidden" name="intent" value="transition"/><input type="hidden" name="orderId" value={order.id}/><input type="hidden" name="targetStatus" value={next[0]}/><button disabled={navigation.state !== "idle"} style={primaryButtonStyle}>{next[1]}</button></Form>}
      {order.productionStatus === "PACKED" && <a href={shopifyAdminUrl(shop, order.shopifyOrderId)} target="_top" style={primaryLinkStyle}>Versandetikett in Shopify erstellen</a>}
      {previousIndex >= 0 && <Form method="post"><input type="hidden" name="intent" value="transition"/><input type="hidden" name="orderId" value={order.id}/><input type="hidden" name="targetStatus" value={PRODUCTION_STATUSES[previousIndex]}/><button>Einen Schritt zurück</button></Form>}
      {order.productionStatus === "BLOCKED" ? <Form method="post"><input type="hidden" name="intent" value="transition"/><input type="hidden" name="orderId" value={order.id}/><input type="hidden" name="targetStatus" value="CHECKED"/><button>Blockierung aufheben</button></Form> : <Form method="post" onSubmit={(event) => { if (!confirm("Bestellung wirklich blockieren?")) event.preventDefault(); }}><input type="hidden" name="intent" value="transition"/><input type="hidden" name="orderId" value={order.id}/><input type="hidden" name="targetStatus" value="BLOCKED"/><input name="note" placeholder="Blockierungsgrund" required/><button>Bestellung blockieren</button></Form>}
      <button type="button" onClick={() => window.print()}>Produktionszettel drucken</button>
      <a href={shopifyAdminUrl(shop, order.shopifyOrderId)} target="_top">Bestellung in Shopify öffnen</a>
    </div>
    <Form method="post" style={cardStyle}><input type="hidden" name="intent" value="note"/><input type="hidden" name="orderId" value={order.id}/><label><strong>Interne Notiz</strong><textarea name="internalNote" defaultValue={order.internalNote || ""} rows="3" style={{ width: "100%" }}/></label><button>Notiz speichern</button></Form>
    <details style={cardStyle}><summary>Originaldaten des Konfigurators anzeigen</summary><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{JSON.stringify(order.lineItems.map((line) => JSON.parse(line.configuration || "[]")), null, 2)}</pre></details>
    <details style={cardStyle}><summary>Statushistorie</summary>{order.statusHistory.length ? order.statusHistory.map((entry) => <p key={entry.id}>{date(entry.createdAt)}: {STATUS_LABELS[entry.previousStatus]} → {STATUS_LABELS[entry.newStatus]} {entry.note && `· ${entry.note}`}</p>) : <p>Noch keine Statusänderung.</p>}</details>
  </div>;
}

export default function Bestellungen() {
  const { orders, shop, customerDataAllowed } = useLoaderData();
  const [params, setParams] = useSearchParams();
  const query = (params.get("q") || "").toLowerCase();
  const filter = params.get("status") || "ALL";
  const selectedId = Number(params.get("order")) || orders[0]?.id;
  const filtered = orders.filter((order) => (filter === "ALL" || order.productionStatus === filter || (filter === "UNKNOWN" && order.review.unknown.length) || (filter === "SHORT" && order.review.short.length)) && order.orderName.toLowerCase().includes(query));
  const selected = orders.find((order) => order.id === selectedId) || filtered[0];
  return <s-page heading="Bestellungen"><div style={workspaceStyle}><aside style={queueStyle}><h2>Bestellwarteschlange</h2><input aria-label="Bestellungen suchen" placeholder="Bestellnummer suchen" value={params.get("q") || ""} onChange={(event) => { const next = new URLSearchParams(params); next.set("q", event.target.value); setParams(next); }} style={inputStyle}/><select aria-label="Status filtern" value={filter} onChange={(event) => { const next = new URLSearchParams(params); next.set("status", event.target.value); setParams(next); }} style={inputStyle}><option value="ALL">Alle</option>{Object.entries(STATUS_LABELS).map(([value,label])=><option key={value} value={value}>{label}</option>)}<option value="SHORT">Fehlbestand</option><option value="UNKNOWN">Nicht erkannte Zutaten</option></select>{filtered.map((order) => <button key={order.id} onClick={() => { const next = new URLSearchParams(params); next.set("order", String(order.id)); setParams(next); }} style={{ ...queueItemStyle, borderColor: order.id === selected?.id ? "#202223" : "#dedede", background: order.id === selected?.id ? "#f3f6f8" : "white" }}><strong>{order.orderName}</strong><span>{date(order.createdAtShopify)}</span><span>{order.lineItems.reduce((s,i)=>s+i.quantity,0)} Mischung(en) · {order.totalWeight.toLocaleString("de-DE")} g</span><span>{STATUS_LABELS[order.productionStatus]} {order.review.short.length ? " · ⚠ Fehlbestand" : ""}{order.review.unknown.length ? " · ⚠ Unbekannt" : ""}</span></button>)}</aside><main style={detailStyle}>{selected ? <OrderDetail order={selected} shop={shop} customerDataAllowed={customerDataAllowed}/> : <s-banner>Keine passende Bestellung gefunden.</s-banner>}</main></div></s-page>;
}

const workspaceStyle={display:"grid",gridTemplateColumns:"minmax(260px, 32%) 1fr",gap:20,alignItems:"start"};
const queueStyle={position:"sticky",top:16,maxHeight:"calc(100vh - 40px)",overflow:"auto",padding:14,border:"1px solid #dedede",borderRadius:14,background:"#fafafa"};
const queueItemStyle={display:"flex",flexDirection:"column",gap:5,width:"100%",textAlign:"left",padding:12,marginTop:9,border:"2px solid",borderRadius:10,cursor:"pointer"};
const detailStyle={minWidth:0}; const inputStyle={width:"100%",padding:10,marginBottom:8,border:"1px solid #bbb",borderRadius:8};
const headerStyle={display:"flex",justifyContent:"space-between",gap:16,alignItems:"start",flexWrap:"wrap"}; const badgeStyle={display:"inline-block",padding:"6px 10px",borderRadius:20,background:"#e8e8e8"};
const stepperStyle={display:"grid",gridTemplateColumns:"repeat(9, minmax(80px,1fr))",gap:4,overflowX:"auto",margin:"18px 0"}; const stepStyle={padding:8,borderRadius:7,fontSize:12,textAlign:"center",display:"grid",gap:3};
const summaryGridStyle={display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12}; const cardStyle={padding:16,border:"1px solid #dedede",borderRadius:12,marginTop:14,background:"white"};
const mixStyle={...cardStyle,background:"#fafafa"}; const ingredientGridStyle={display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:14}; const groupStyle={padding:12,border:"1px solid #e3e3e3",borderRadius:10,background:"white"};
const ingredientStyle={display:"grid",gridTemplateColumns:"24px 80px 1fr auto",alignItems:"center",gap:8,padding:"9px 0",borderBottom:"1px solid #eee"}; const warningStyle={color:"#8a6116",fontWeight:700}; const successStyle={color:"#08733c",fontWeight:700};
const weightStyle={display:"flex",gap:18,flexWrap:"wrap",padding:16,marginTop:14,borderRadius:12,background:"#f1f2f3"}; const actionsStyle={display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",margin:"18px 0"};
const primaryButtonStyle={padding:"12px 18px",border:0,borderRadius:8,background:"#202223",color:"white",fontWeight:700,cursor:"pointer"}; const primaryLinkStyle={...primaryButtonStyle,textDecoration:"none"}; const buttonLinkStyle={display:"inline-block",padding:"9px 13px",borderRadius:8,background:"#202223",color:"white",textDecoration:"none"};

export const headers = (headersArgs) => boundary.headers(headersArgs);
