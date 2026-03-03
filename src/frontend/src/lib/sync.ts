import { getBackendActor } from "./backendService";
import {
  getPendingOrderItems,
  getPendingOrders,
  removePendingOrder,
} from "./db";

export async function syncPendingOrders(
  _userId: string,
): Promise<{ synced: number; failed: number }> {
  const pendingOrders = await getPendingOrders();
  let synced = 0;
  let failed = 0;

  for (const order of pendingOrders) {
    try {
      const backend = await getBackendActor();
      const items = await getPendingOrderItems(order.id);
      await backend.submitOrder(order, items);
      await backend.syncOrder(order.id);
      await removePendingOrder(order.id);
      synced++;
    } catch {
      failed++;
    }
  }

  return { synced, failed };
}
