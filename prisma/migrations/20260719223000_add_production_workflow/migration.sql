-- Additive production workflow migration. Existing orders and ingredient data remain untouched.
CREATE TABLE "Order" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, "shop" TEXT NOT NULL,
  "shopifyOrderId" TEXT NOT NULL, "orderName" TEXT NOT NULL, "createdAtShopify" DATETIME NOT NULL,
  "paymentStatus" TEXT, "fulfillmentStatus" TEXT, "productionStatus" TEXT NOT NULL DEFAULT 'NEW',
  "priority" INTEGER NOT NULL DEFAULT 0, "blockedReason" TEXT, "internalNote" TEXT,
  "totalWeight" REAL NOT NULL DEFAULT 0, "totalPriceCents" INTEGER NOT NULL DEFAULT 0,
  "currencyCode" TEXT NOT NULL DEFAULT 'EUR', "customerName" TEXT, "customerEmail" TEXT,
  "customerPhone" TEXT, "shippingAddress" TEXT, "shippingMethod" TEXT, "trackingNumber" TEXT,
  "trackingUrl" TEXT, "shippingCarrier" TEXT, "labelStatus" TEXT NOT NULL DEFAULT 'MISSING',
  "rawData" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "Order_shop_shopifyOrderId_key" ON "Order"("shop", "shopifyOrderId");
CREATE INDEX "Order_shop_productionStatus_idx" ON "Order"("shop", "productionStatus");
CREATE INDEX "Order_shop_createdAtShopify_idx" ON "Order"("shop", "createdAtShopify");

CREATE TABLE "OrderLineItem" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, "shop" TEXT NOT NULL, "shopifyLineItemId" TEXT NOT NULL,
  "orderId" INTEGER NOT NULL, "title" TEXT NOT NULL, "quantity" INTEGER NOT NULL,
  "unitPriceCents" INTEGER NOT NULL DEFAULT 0, "currencyCode" TEXT NOT NULL DEFAULT 'EUR',
  "configuration" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "OrderLineItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "OrderLineItem_shop_shopifyLineItemId_key" ON "OrderLineItem"("shop", "shopifyLineItemId");
CREATE INDEX "OrderLineItem_orderId_idx" ON "OrderLineItem"("orderId");

CREATE TABLE "OrderIngredient" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, "orderId" INTEGER NOT NULL, "lineItemId" INTEGER NOT NULL,
  "ingredientId" INTEGER, "name" TEXT NOT NULL, "category" TEXT NOT NULL, "gramsPerMix" REAL,
  "totalGrams" REAL, "mappingStatus" TEXT NOT NULL DEFAULT 'UNKNOWN', "costCents" INTEGER,
  "checked" BOOLEAN NOT NULL DEFAULT false, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "OrderIngredient_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OrderIngredient_lineItemId_fkey" FOREIGN KEY ("lineItemId") REFERENCES "OrderLineItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OrderIngredient_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "OrderIngredient_lineItemId_name_key" ON "OrderIngredient"("lineItemId", "name");
CREATE INDEX "OrderIngredient_orderId_idx" ON "OrderIngredient"("orderId");
CREATE INDEX "OrderIngredient_ingredientId_idx" ON "OrderIngredient"("ingredientId");

CREATE TABLE "ProductionOrder" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, "orderId" INTEGER NOT NULL, "status" TEXT NOT NULL DEFAULT 'NEW',
  "startedAt" DATETIME, "packedAt" DATETIME, "readyAt" DATETIME, "completedAt" DATETIME, "blockedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ProductionOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ProductionOrder_orderId_key" ON "ProductionOrder"("orderId");

CREATE TABLE "ProductionStatusHistory" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, "shop" TEXT NOT NULL, "orderId" INTEGER NOT NULL,
  "previousStatus" TEXT NOT NULL, "newStatus" TEXT NOT NULL, "actor" TEXT, "note" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductionStatusHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductionStatusHistory_shop_orderId_createdAt_idx" ON "ProductionStatusHistory"("shop", "orderId", "createdAt");

CREATE TABLE "StockMovement" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, "shop" TEXT NOT NULL, "ingredientId" INTEGER NOT NULL,
  "orderId" INTEGER, "type" TEXT NOT NULL, "quantityGrams" REAL NOT NULL, "idempotencyKey" TEXT NOT NULL,
  "note" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockMovement_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "StockMovement_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "StockMovement_shop_idempotencyKey_key" ON "StockMovement"("shop", "idempotencyKey");
CREATE INDEX "StockMovement_shop_ingredientId_idx" ON "StockMovement"("shop", "ingredientId");
CREATE INDEX "StockMovement_orderId_idx" ON "StockMovement"("orderId");

CREATE TABLE "WebhookEvent" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, "shop" TEXT NOT NULL, "webhookId" TEXT NOT NULL,
  "topic" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'RECEIVED', "error" TEXT, "processedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "WebhookEvent_shop_webhookId_key" ON "WebhookEvent"("shop", "webhookId");
CREATE INDEX "WebhookEvent_shop_topic_createdAt_idx" ON "WebhookEvent"("shop", "topic", "createdAt");
