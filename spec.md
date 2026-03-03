# Sales Catalog PWA

## Current State
- Full-stack app with Motoko backend and React/TypeScript frontend
- Language: supports Traditional Chinese and English (simplified Chinese was removed in a prior pass; language store already uses `"traditional" | "english"`)
- Product type: `{ id, sku, nameCnSimplified, nameCnTraditional, category, price, stockStatus, imageUrl, createdAt, updatedAt }`
- Admin: product management, user management, customer management pages
- No Category entity exists in backend or frontend

## Requested Changes (Diff)

### Add
- **Category table/entity** in backend: `{ id, catId, catEn, catCn, subCat, createdAt, updatedAt }`
- Backend CRUD for categories: `upsertCategory`, `getCategory`, `getAllCategories`, `deleteCategory`
- New admin section: **Category Management** page (`/admin/categories`) with full CRUD table UI
- Navigation card for Category Management on AdminDashboard
- Extra product fields: `categoryId` (Text), `brand` (Text), `nameEn` (Text), `size` (Text), `bbd` (Text, ISO date string), `vat` (Float), `uom` (Text), `stock` (Nat), `promotions` (Text)
- New translation keys for all new fields (Traditional Chinese + English)

### Modify
- Backend `Product` type: add `categoryId`, `brand`, `nameEn`, `size`, `bbd`, `vat`, `uom`, `stock`, `promotions`
- Backend `upsertProductBySku`: update fields included in the upsert
- `backend.d.ts`: reflect updated Product type and new Category type + methods
- `ProductManagement.tsx`: add form fields for all new product fields; update table columns
- `sampleData.ts`: update SAMPLE_PRODUCTS to include new fields with default/empty values
- `translations.ts`: add keys for new product fields and category management
- `AdminDashboard.tsx`: add Category Management nav card; update description strings to use translations only (no hardcoded strings)
- `App.tsx`: add route `/admin/categories`

### Remove
- `nameCnSimplified` field from Product (rename to keep only `nameCnTraditional` and new `nameEn`; however to avoid breaking existing data, keep `nameCnSimplified` in backend for backward compat but the frontend will stop displaying/requiring it -- **actually**: keep `nameCnSimplified` in the backend type to avoid breaking existing data, but the product form will focus on `nameCnTraditional` and `nameEn` as the primary display fields)
- Any remaining hardcoded Simplified Chinese UI text in frontend components

## Implementation Plan
1. Update `main.mo`: add Category type + CRUD, extend Product type with new fields
2. Regenerate `backend.d.ts` to match new Motoko types
3. Update `translations.ts`: add keys for new product/category fields, remove/fix any simplified Chinese in translation values
4. Update `sampleData.ts`: populate new product fields with sensible defaults
5. Update `ProductManagement.tsx`: add new form fields (categoryId, brand, nameEn, size, bbd, vat, uom, stock, promotions), update table
6. Create `CategoryManagement.tsx`: full CRUD page for categories
7. Update `AdminDashboard.tsx`: add category management card, fix hardcoded strings
8. Update `App.tsx`: add `/admin/categories` route
9. Update `db.ts`: add categories_cache store
