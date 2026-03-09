// Local types not exported from backend.d.ts
import type { Product } from "./backend.d";

// Re-export Category from backend.d — it is the canonical type now.
// The local Category definition has been superseded by the backend version.
export type { Category } from "./backend.d";

export interface Customer {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  createdAt: bigint;
}

// Frontend ExtendedProduct: combines base Product fields + backend ExtendedProduct extended fields.
// imageBlobUrl is local-only and never sent to backend.
export interface ExtendedProduct extends Product {
  categoryId: string;
  brand: string;
  nameEn: string;
  size: string;
  bbd: string; // ISO date string e.g. "2026-12-31"
  vat: number;
  uom: string;
  stock: number;
  promotions: string;
  imageFileName: string; // filename to match against uploaded image folder (e.g. "product-001.jpg")
  imageBlobUrl?: string; // resolved blob URL for display — local only, not sent to backend
}

// Container entity stored in IndexedDB
export interface Container {
  id: string;
  containerNo: string;
  shipmentNo?: string;
  shipper: string;
  eta: string; // ISO date string
  entryPort: string;
  status: string; // "In Transit" | "Arrived" | "Customs Cleared"
  notes: string;
  createdAt: bigint;
  updatedAt: bigint;
}

// ContainerItem entity stored in IndexedDB
export interface ContainerItem {
  id: string;
  containerId: string;
  productSku: string;
  productName: string;
  qty: bigint;
  sellingPrice: number;
  bbd: string;
}
