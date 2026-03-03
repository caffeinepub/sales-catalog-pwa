# Sales Catalog PWA

## Current State
- ProductManagement: A-Z alphabet filter bar only renders inside the `filtered.length > 0` branch -- it disappears when a search returns no results.
- ContainerManagement: product items are entered manually (SKU + name). No bulk Product_ID upload. No "Shipment #" field on containers.
- Authorization: only two roles exist -- admin and sales_rep. No per-user "container editor" permission flag. All users with access to the admin area can currently edit containers.

## Requested Changes (Diff)

### Add
- `shipmentNo` field on the `Container` type, persisted in IndexedDB.
- "Shipment #" input in the container add/edit modal.
- "Shipment #" column in the containers table.
- Bulk Product_ID upload button in ContainerManagement modal: paste or upload a list of SKUs; the app looks up each SKU in extended_products and auto-fills the product rows (name, price, etc.).
- `canEditContainers` boolean permission flag on `UserRecord` (UserManagement) and on the auth session.
- Permission check in ContainerManagement: if the current user does not have `canEditContainers`, hide the Add / Edit / Delete buttons and show a read-only view. All users (admin included) default to allowed; new non-admin users default to not allowed unless the admin grants it.
- Toggle in UserManagement per-user edit form to grant/revoke "Container Editor" permission.

### Modify
- ProductManagement: move the alphabet strip (and page info) outside the `filtered.length > 0` conditional so it always renders, even when the table is empty.
- ContainerManagement: add `shipmentNo` to form state, save/load in handleSave/openEdit, display in table.
- UserManagement: add `canEditContainers` field to `UserRecord`, default admin to `true`, default others to `false`. Show a toggle in the edit form.
- useAuthStore / AuthUser: add `canEditContainers?: boolean` to `AuthUser` so the session carries the permission.
- db.ts: bump DB version to 6, add migration for containers_cache to handle new `shipmentNo` field (safe because it is optional).

### Remove
- Nothing removed.

## Implementation Plan
1. `types.ts` -- add `shipmentNo?: string` to `Container`.
2. `useAuthStore.ts` -- add `canEditContainers?: boolean` to `AuthUser`.
3. `db.ts` -- bump version to 6 with upgrade that clears and recreates `containers_cache` to pick up new field.
4. `UserManagement.tsx` -- add `canEditContainers` to `UserRecord`, default admin=true others=false, add toggle in edit form, persist it, update auth session when user edits themselves.
5. `ContainerManagement.tsx`:
   a. Add `shipmentNo` field to `ContainerForm`, modal, table column.
   b. Add "Bulk Upload SKUs" button in product items section; opens a textarea where user pastes SKUs (one per line); on confirm, look up each SKU in `getAllExtendedProducts()` and add/replace matching item rows.
   c. Read `canEditContainers` from auth store; hide add/edit/delete controls and show a "Read Only" badge when false.
6. `ProductManagement.tsx` -- move alphabet strip + page-info paragraph out of the `filtered.length > 0` block so they always render (alongside empty state).
