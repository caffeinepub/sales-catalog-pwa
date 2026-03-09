import { type DBSchema, type IDBPDatabase, openDB } from "idb";
import type {
  AppUser,
  Category,
  Order,
  OrderItem,
  Product,
} from "../backend.d";
import type {
  Container,
  ContainerItem,
  Customer,
  ExtendedProduct,
} from "../types";

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
  image_blobs_cache: {
    key: string;
    value: { fileName: string; bytes: Uint8Array };
  };
  containers_cache: {
    key: string;
    value: Container;
  };
  container_items_cache: {
    key: string;
    value: ContainerItem;
    indexes: { "by-container": string };
  };
}

let dbPromise: Promise<IDBPDatabase<SalesCatalogDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<SalesCatalogDB>("sales-catalog-db", 5, {
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
        if (oldVersion < 3) {
          // Schema changed: imageUrl removed, imageFileName/imageBlobUrl added.
          // Clear and recreate to avoid type errors from old cached records.
          if (db.objectStoreNames.contains("extended_products")) {
            db.deleteObjectStore("extended_products");
          }
          db.createObjectStore("extended_products", { keyPath: "id" });
        }
        if (oldVersion < 4) {
          if (!db.objectStoreNames.contains("image_blobs_cache")) {
            db.createObjectStore("image_blobs_cache", { keyPath: "fileName" });
          }
        }
        if (oldVersion < 5) {
          if (!db.objectStoreNames.contains("containers_cache")) {
            db.createObjectStore("containers_cache", { keyPath: "id" });
          }
          if (!db.objectStoreNames.contains("container_items_cache")) {
            const store = db.createObjectStore("container_items_cache", {
              keyPath: "id",
            });
            store.createIndex("by-container", "containerId");
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

/**
 * Bulk-replace the categories cache with a fresh list from the backend.
 * Clears the store first to remove stale entries.
 */
export async function saveCategoriesToCache(
  categories: Category[],
): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("categories_cache", "readwrite");
  await tx.store.clear();
  await Promise.all([...categories.map((c) => tx.store.put(c)), tx.done]);
}

// ── App Users (localStorage cache for offline fallback) ─────────────────────

const APP_USERS_CACHE_KEY = "sales_catalog_app_users_cache";

export function saveAppUsersToCache(users: AppUser[]): void {
  try {
    localStorage.setItem(APP_USERS_CACHE_KEY, JSON.stringify(users));
  } catch {
    // ignore storage errors
  }
}

export function getAppUsersFromCache(): AppUser[] {
  try {
    const raw = localStorage.getItem(APP_USERS_CACHE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as AppUser[];
  } catch {
    return [];
  }
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

// Image Blobs Cache
export async function saveImageBlob(
  fileName: string,
  bytes: Uint8Array,
): Promise<void> {
  const db = await getDB();
  await db.put("image_blobs_cache", { fileName, bytes });
}

export async function getImageBlob(
  fileName: string,
): Promise<Uint8Array | undefined> {
  const db = await getDB();
  const entry = await db.get("image_blobs_cache", fileName);
  return entry?.bytes;
}

// Containers
export async function saveContainer(container: Container): Promise<void> {
  const db = await getDB();
  await db.put("containers_cache", container);
}

export async function getAllContainers(): Promise<Container[]> {
  const db = await getDB();
  return db.getAll("containers_cache");
}

export async function deleteContainerFromDb(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("containers_cache", id);
}

// Container Items
export async function saveContainerItem(item: ContainerItem): Promise<void> {
  const db = await getDB();
  await db.put("container_items_cache", item);
}

export async function getContainerItems(
  containerId: string,
): Promise<ContainerItem[]> {
  const db = await getDB();
  return db.getAllFromIndex(
    "container_items_cache",
    "by-container",
    containerId,
  );
}

export async function deleteContainerItem(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("container_items_cache", id);
}

export async function deleteAllContainerItems(
  containerId: string,
): Promise<void> {
  const db = await getDB();
  const items = await db.getAllFromIndex(
    "container_items_cache",
    "by-container",
    containerId,
  );
  const tx = db.transaction("container_items_cache", "readwrite");
  await Promise.all([
    ...items.map((item) => tx.store.delete(item.id)),
    tx.done,
  ]);
}
