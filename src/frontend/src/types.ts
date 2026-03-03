// Local types not exported from backend.d.ts
import type { Product } from "./backend.d";

export interface Customer {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  createdAt: bigint;
}

// Extended product with additional frontend-only fields stored in IndexedDB
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
  imageBlobUrl?: string; // resolved blob URL for display after image is uploaded
}

// Category entity stored in IndexedDB
export interface Category {
  id: string;
  catId: string;
  catEn: string;
  catCn: string;
  subCat: string;
  createdAt: bigint;
  updatedAt: bigint;
}
