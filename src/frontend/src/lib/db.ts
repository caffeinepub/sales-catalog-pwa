import { type DBSchema, type IDBPDatabase, openDB } from "idb";
import type { Order, OrderItem, Product } from "../backend.d";
import type { Category, Customer, ExtendedProduct } from "../types";

interface SalesCatalogDB extends DBSchema {
  products_cache: {
    key: string;
    value: Product;
  };
  customers_cache: {
    key: string;
    value: Customer;
  };
  pending_orders: {
    key: string;
    value: Order;
  };
  pending_order_items: {
    key: string;
    value: OrderItem;
    indexes: { "by-order": string };
  };
  extended_products: {
    key: string;
    value: ExtendedProduct;
  };
  categories_cache: {
    key: string;
    value: Category;
  };
}

let dbPromise: Promise<IDBPDatabase<SalesCatalogDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<SalesCatalogDB>("sales-catalog-db", 2, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          if (!db.objectStoreNames.contains("products_cache")) {
            db.createObjectStore("products_cache", { keyPath: "id" });
          }
          if (!db.objectStoreNames.contains("customers_cache")) {
            db.createObjectStore("customers_cache", { keyPath: "id" });
          }
          if (!db.objectStoreNames.contains("pending_orders")) {
            db.createObjectStore("pending_orders", { keyPath: "id" });
          }
          if (!db.objectStoreNames.contains("pending_order_items")) {
            const store = db.createObjectStore("pending_order_items", {
              keyPath: "id",
            });
            store.createIndex("by-order", "orderId");
          }
        }
        if (oldVersion < 2) {
          if (!db.objectStoreNames.contains("extended_products")) {
            db.createObjectStore("extended_products", { keyPath: "id" });
          }
          if (!db.objectStoreNames.contains("categories_cache")) {
            db.createObjectStore("categories_cache", { keyPath: "id" });
          }
        }
      },
    });
  }
  return dbPromise;
}

// Products (base backend type)
export async function saveProductsToCache(products: Product[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("products_cache", "readwrite");
  await Promise.all([...products.map((p) => tx.store.put(p)), tx.done]);
}

export async function getProductsFromCache(): Promise<Product[]> {
  const db = await getDB();
  return db.getAll("products_cache");
}

// Extended Products (frontend-only extra fields)
export async function saveExtendedProduct(
  product: ExtendedProduct,
): Promise<void> {
  const db = await getDB();
  await db.put("extended_products", product);
}

export async function getExtendedProduct(
  id: string,
): Promise<ExtendedProduct | undefined> {
  const db = await getDB();
  return db.get("extended_products", id);
}

export async function getAllExtendedProducts(): Promise<ExtendedProduct[]> {
  const db = await getDB();
  return db.getAll("extended_products");
}

export async function saveAllExtendedProducts(
  products: ExtendedProduct[],
): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("extended_products", "readwrite");
  await Promise.all([...products.map((p) => tx.store.put(p)), tx.done]);
}

export async function deleteExtendedProduct(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("extended_products", id);
}

// Customers
export async function saveCustomersToCache(
  customers: Customer[],
): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("customers_cache", "readwrite");
  await Promise.all([...customers.map((c) => tx.store.put(c)), tx.done]);
}

export async function getCustomersFromCache(): Promise<Customer[]> {
  const db = await getDB();
  return db.getAll("customers_cache");
}

// Categories
export async function saveCategory(category: Category): Promise<void> {
  const db = await getDB();
  await db.put("categories_cache", category);
}

export async function getAllCategories(): Promise<Category[]> {
  const db = await getDB();
  return db.getAll("categories_cache");
}

export async function deleteCategory(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("categories_cache", id);
}

// Pending Orders
export async function savePendingOrder(
  order: Order,
  items: OrderItem[],
): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(
    ["pending_orders", "pending_order_items"],
    "readwrite",
  );
  await tx.objectStore("pending_orders").put(order);
  await Promise.all(
    items.map((item) => tx.objectStore("pending_order_items").put(item)),
  );
  await tx.done;
}

export async function getPendingOrders(): Promise<Order[]> {
  const db = await getDB();
  return db.getAll("pending_orders");
}

export async function getPendingOrderItems(
  orderId: string,
): Promise<OrderItem[]> {
  const db = await getDB();
  return db.getAllFromIndex("pending_order_items", "by-order", orderId);
}

export async function removePendingOrder(orderId: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(
    ["pending_orders", "pending_order_items"],
    "readwrite",
  );
  await tx.objectStore("pending_orders").delete(orderId);
  const items = await tx
    .objectStore("pending_order_items")
    .index("by-order")
    .getAllKeys(orderId);
  await Promise.all(
    items.map((key) => tx.objectStore("pending_order_items").delete(key)),
  );
  await tx.done;
}
