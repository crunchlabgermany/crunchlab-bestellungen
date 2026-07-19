-- CreateTable
CREATE TABLE "IngredientAlias" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shop" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "ingredientId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "IngredientAlias_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "IngredientAlias_shop_idx" ON "IngredientAlias"("shop");
CREATE INDEX "IngredientAlias_ingredientId_idx" ON "IngredientAlias"("ingredientId");
CREATE UNIQUE INDEX "IngredientAlias_shop_alias_key" ON "IngredientAlias"("shop", "alias");

-- Idempotent ingredient master-data import for the existing Crunchlab shop.
INSERT INTO "Ingredient" ("shop", "name", "category", "purchaseWeight", "purchasePrice", "stockWeight", "minimumStock", "supplier", "active", "createdAt", "updatedAt")
VALUES
  ('p1s9iw-q4.myshopify.com', 'Choco Balls', 'Basis', 1000, 3.32, 0, 0, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('p1s9iw-q4.myshopify.com', 'Choco Cream Bites', 'Basis', 1000, 3.32, 0, 0, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('p1s9iw-q4.myshopify.com', 'White Cream Bites', 'Basis', 1000, 3.32, 0, 0, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('p1s9iw-q4.myshopify.com', 'Dark Cream Bites', 'Basis', 1000, 3.32, 0, 0, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('p1s9iw-q4.myshopify.com', 'Crunchi Stars', 'Basis', 1000, 3.32, 0, 0, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('p1s9iw-q4.myshopify.com', 'Honey Chips', 'Basis', 1000, 3.84, 0, 0, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('p1s9iw-q4.myshopify.com', 'Honey Pops', 'Basis', 1000, 3.84, 0, 0, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('p1s9iw-q4.myshopify.com', 'Schoko Chips', 'Basis', 1000, 3.84, 0, 0, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('p1s9iw-q4.myshopify.com', 'Zimt Sternen Himmel', 'Basis', 1000, 3.95, 0, 0, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('p1s9iw-q4.myshopify.com', 'Choco Cookie Crunch Müsli', 'Basis', 1000, 4.15, 0, 0, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('p1s9iw-q4.myshopify.com', 'Chocolate Crunch Müsli', 'Basis', 1000, 4.15, 0, 0, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('p1s9iw-q4.myshopify.com', 'Schokolierte Erdnüsse', 'Topping', 1000, 6.23, 0, 0, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('p1s9iw-q4.myshopify.com', 'Cookie Dream', 'Topping', 1000, 6.62, 0, 0, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('p1s9iw-q4.myshopify.com', 'Lotus Crunch', 'Topping', 1000, 8.95, 0, 0, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('p1s9iw-q4.myshopify.com', 'Puffa Pop', 'Topping', 1000, 9.88, 0, 0, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('p1s9iw-q4.myshopify.com', 'Gebrannte Erdnüsse', 'Topping', 1000, 9.97, 0, 0, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('p1s9iw-q4.myshopify.com', 'Mini Marshmallows', 'Topping', 1000, 9.95, 0, 0, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('p1s9iw-q4.myshopify.com', 'Jelly Beans', 'Topping', 1000, 11.96, 0, 0, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('p1s9iw-q4.myshopify.com', 'Crunchi Schoko Mandeln', 'Topping', 1000, 13.95, 0, 0, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('p1s9iw-q4.myshopify.com', 'Toffifee caramel', 'Topping', 1000, 16.95, 0, 0, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('p1s9iw-q4.myshopify.com', 'Toffifee White', 'Topping', 1000, 16.95, 0, 0, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('p1s9iw-q4.myshopify.com', 'Neo Crunch', 'Topping', 1000, 6.50, 0, 0, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('p1s9iw-q4.myshopify.com', 'Choco Rosinen', 'Topping', 1000, 8.50, 0, 0, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT("shop", "name") DO UPDATE SET
  "category" = excluded."category",
  "purchaseWeight" = excluded."purchaseWeight",
  "purchasePrice" = excluded."purchasePrice",
  "active" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

-- Keep storefront wording separate from canonical ingredient names.
INSERT INTO "IngredientAlias" ("shop", "alias", "ingredientId", "createdAt", "updatedAt")
SELECT 'p1s9iw-q4.myshopify.com', aliases.alias, ingredient.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (
  SELECT 'Choco Crunch Müsli' AS alias, 'Chocolate Crunch Müsli' AS ingredientName
  UNION ALL SELECT 'Choco Chips', 'Schoko Chips'
  UNION ALL SELECT 'Zimtsternen Himmel', 'Zimt Sternen Himmel'
) AS aliases
JOIN "Ingredient" AS ingredient
  ON ingredient."shop" = 'p1s9iw-q4.myshopify.com'
 AND ingredient."name" = aliases.ingredientName
ON CONFLICT("shop", "alias") DO UPDATE SET
  "ingredientId" = excluded."ingredientId",
  "updatedAt" = CURRENT_TIMESTAMP;
