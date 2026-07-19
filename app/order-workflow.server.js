import db from "./db.server.js";
import { calculateReview, parseLineItem, PRODUCTION_STATUSES } from "./order-workflow.js";

export async function syncShopifyOrders(shop, shopifyOrders) {
  const ingredients = await db.ingredient.findMany({ where: { shop }, include: { aliases: true } });
  for (const source of shopifyOrders) {
    const totalMoney = source.totalPriceSet?.shopMoney || {};
    const localOrder = await db.order.upsert({
      where: { shop_shopifyOrderId: { shop, shopifyOrderId: source.id } },
      create: {
        shop, shopifyOrderId: source.id, orderName: source.name, createdAtShopify: new Date(source.createdAt),
        paymentStatus: source.displayFinancialStatus, fulfillmentStatus: source.displayFulfillmentStatus,
        totalPriceCents: Math.round(Number(totalMoney.amount || 0) * 100), currencyCode: totalMoney.currencyCode || "EUR",
        rawData: JSON.stringify(source), productionOrder: { create: {} },
      },
      update: {
        orderName: source.name, paymentStatus: source.displayFinancialStatus,
        fulfillmentStatus: source.displayFulfillmentStatus, totalPriceCents: Math.round(Number(totalMoney.amount || 0) * 100),
        currencyCode: totalMoney.currencyCode || "EUR", rawData: JSON.stringify(source),
      },
    });
    let totalWeight = 0;
    for (const sourceLine of source.lineItems?.nodes || []) {
      const line = await db.orderLineItem.upsert({
        where: { shop_shopifyLineItemId: { shop, shopifyLineItemId: sourceLine.id } },
        create: {
          shop, shopifyLineItemId: sourceLine.id, orderId: localOrder.id, title: sourceLine.name || sourceLine.title,
          quantity: sourceLine.quantity, unitPriceCents: Math.round(Number(sourceLine.originalUnitPriceSet?.shopMoney?.amount || 0) * 100),
          currencyCode: sourceLine.originalUnitPriceSet?.shopMoney?.currencyCode || "EUR", configuration: JSON.stringify(sourceLine.customAttributes || []),
        },
        update: { title: sourceLine.name || sourceLine.title, quantity: sourceLine.quantity, configuration: JSON.stringify(sourceLine.customAttributes || []) },
      });
      for (const parsed of parseLineItem(sourceLine, ingredients)) {
        if (parsed.mappingStatus === "MATCHED") totalWeight += Number(parsed.totalGrams || 0);
        await db.orderIngredient.upsert({
          where: { lineItemId_name: { lineItemId: line.id, name: parsed.name } },
          create: { orderId: localOrder.id, lineItemId: line.id, ...parsed },
          update: parsed,
        });
      }
    }
    await db.order.update({ where: { id: localOrder.id }, data: { totalWeight } });
  }
}

async function reserveOrder(transaction, order) {
  const grouped = new Map();
  for (const item of order.ingredients) {
    if (!item.ingredientId || item.totalGrams === null) continue;
    grouped.set(item.ingredientId, (grouped.get(item.ingredientId) || 0) + item.totalGrams);
  }
  for (const [ingredientId, grams] of grouped) {
    const ingredient = await transaction.ingredient.findUnique({ where: { id: ingredientId } });
    const reservations = await transaction.stockMovement.aggregate({ where: { shop: order.shop, ingredientId, type: "RESERVATION" }, _sum: { quantityGrams: true } });
    const releases = await transaction.stockMovement.aggregate({ where: { shop: order.shop, ingredientId, type: { in: ["RELEASE", "CANCELLATION"] } }, _sum: { quantityGrams: true } });
    const available = Number(ingredient?.stockWeight || 0) + Number(reservations._sum.quantityGrams || 0) + Number(releases._sum.quantityGrams || 0);
    if (available < grams) throw new Error(`Fehlbestand bei ${ingredient?.name || "Zutat"}: ${grams} g benötigt, ${available} g verfügbar.`);
    await transaction.stockMovement.upsert({
      where: { shop_idempotencyKey: { shop: order.shop, idempotencyKey: `order:${order.id}:reservation:${ingredientId}` } },
      create: { shop: order.shop, orderId: order.id, ingredientId, type: "RESERVATION", quantityGrams: -grams, idempotencyKey: `order:${order.id}:reservation:${ingredientId}` },
      update: {},
    });
  }
}

async function consumeOrder(transaction, order) {
  const reservations = await transaction.stockMovement.findMany({ where: { orderId: order.id, type: "RESERVATION" } });
  for (const reservation of reservations) {
    const key = `order:${order.id}:consumption:${reservation.ingredientId}`;
    const exists = await transaction.stockMovement.findUnique({ where: { shop_idempotencyKey: { shop: order.shop, idempotencyKey: key } } });
    if (!exists) {
      await transaction.stockMovement.create({ data: { shop: order.shop, orderId: order.id, ingredientId: reservation.ingredientId, type: "CONSUMPTION", quantityGrams: reservation.quantityGrams, idempotencyKey: key } });
      await transaction.ingredient.update({ where: { id: reservation.ingredientId }, data: { stockWeight: { increment: reservation.quantityGrams } } });
    }
  }
}

export async function transitionOrder({ shop, orderId, targetStatus, note, actor }) {
  return db.$transaction(async (transaction) => {
    const order = await transaction.order.findFirst({ where: { id: orderId, shop }, include: { ingredients: { include: { ingredient: true } }, lineItems: true } });
    if (!order) throw new Error("Bestellung nicht gefunden.");
    const currentIndex = PRODUCTION_STATUSES.indexOf(order.productionStatus);
    const targetIndex = PRODUCTION_STATUSES.indexOf(targetStatus);
    const isBlockChange = targetStatus === "BLOCKED" || (order.productionStatus === "BLOCKED" && targetStatus === "CHECKED");
    if (!isBlockChange && (targetIndex < 0 || Math.abs(targetIndex - currentIndex) !== 1)) throw new Error("Dieser Statussprung ist nicht erlaubt.");
    if (targetStatus === "RELEASED") {
      const review = calculateReview(order);
      if (review.blockingReasons.length) throw new Error(`Freigabe blockiert: ${review.blockingReasons.join(", ")}`);
      await reserveOrder(transaction, order);
    }
    if (targetStatus === "PACKED") await consumeOrder(transaction, order);
    const now = new Date();
    await transaction.order.update({ where: { id: order.id }, data: { productionStatus: targetStatus, blockedReason: targetStatus === "BLOCKED" ? note || "Manuell blockiert" : null } });
    await transaction.productionOrder.upsert({
      where: { orderId: order.id }, create: { orderId: order.id, status: targetStatus },
      update: { status: targetStatus, startedAt: targetStatus === "IN_PRODUCTION" ? now : undefined, packedAt: targetStatus === "PACKED" ? now : undefined, readyAt: targetStatus === "READY_TO_SHIP" ? now : undefined, completedAt: targetStatus === "COMPLETED" ? now : undefined, blockedAt: targetStatus === "BLOCKED" ? now : undefined },
    });
    await transaction.productionStatusHistory.create({ data: { shop, orderId: order.id, previousStatus: order.productionStatus, newStatus: targetStatus, actor, note } });
    return order.id;
  });
}

export async function cancelOrderReservations(shop, shopifyOrderId) {
  return db.$transaction(async (transaction) => {
    const order = await transaction.order.findUnique({ where: { shop_shopifyOrderId: { shop, shopifyOrderId } } });
    if (!order) return;
    const reservations = await transaction.stockMovement.findMany({ where: { orderId: order.id, type: "RESERVATION" } });
    for (const reservation of reservations) {
      const key = `order:${order.id}:cancellation:${reservation.ingredientId}`;
      await transaction.stockMovement.upsert({
        where: { shop_idempotencyKey: { shop, idempotencyKey: key } },
        create: { shop, orderId: order.id, ingredientId: reservation.ingredientId, type: "CANCELLATION", quantityGrams: Math.abs(reservation.quantityGrams), idempotencyKey: key },
        update: {},
      });
      const consumed = await transaction.stockMovement.findUnique({ where: { shop_idempotencyKey: { shop, idempotencyKey: `order:${order.id}:consumption:${reservation.ingredientId}` } } });
      const restockKey = `order:${order.id}:cancellation-restock:${reservation.ingredientId}`;
      const restocked = await transaction.stockMovement.findUnique({ where: { shop_idempotencyKey: { shop, idempotencyKey: restockKey } } });
      if (consumed && !restocked) {
        await transaction.stockMovement.create({ data: { shop, orderId: order.id, ingredientId: reservation.ingredientId, type: "CANCELLATION", quantityGrams: Math.abs(consumed.quantityGrams), idempotencyKey: restockKey, note: "Verbrauch nach Shopify-Storno zurückgebucht" } });
        await transaction.ingredient.update({ where: { id: reservation.ingredientId }, data: { stockWeight: { increment: Math.abs(consumed.quantityGrams) } } });
      }
    }
    await transaction.order.update({ where: { id: order.id }, data: { productionStatus: "BLOCKED", blockedReason: "Bestellung in Shopify storniert" } });
  });
}

export async function recordWebhook({ shop, webhookId, topic, handler }) {
  try { await db.webhookEvent.create({ data: { shop, webhookId, topic } }); }
  catch (error) { if (error?.code === "P2002") return { duplicate: true }; throw error; }
  try {
    await handler();
    await db.webhookEvent.update({ where: { shop_webhookId: { shop, webhookId } }, data: { status: "PROCESSED", processedAt: new Date() } });
    return { duplicate: false };
  } catch (error) {
    await db.webhookEvent.update({ where: { shop_webhookId: { shop, webhookId } }, data: { status: "FAILED", error: String(error?.message || error).slice(0, 1000) } });
    throw error;
  }
}
