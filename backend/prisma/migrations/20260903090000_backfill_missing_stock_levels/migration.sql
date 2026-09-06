INSERT INTO "StockLevel" ("id", "productId", "currentQuantity", "createdAt", "updatedAt")
SELECT 'stock_' || p."id", p."id", 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Product" AS p
WHERE NOT EXISTS (
  SELECT 1
  FROM "StockLevel" AS stock_level
  WHERE stock_level."productId" = p."id"
);