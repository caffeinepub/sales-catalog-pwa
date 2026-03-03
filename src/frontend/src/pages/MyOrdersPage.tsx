import { Button } from "@/components/ui/button";
import { ChevronRight, ClipboardList, Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { Order, OrderItem } from "../backend.d";
import { OrderDetailModal } from "../components/OrderDetailModal";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { getBackendActor } from "../lib/backendService";
import { getPendingOrderItems, getPendingOrders } from "../lib/db";
import { syncPendingOrders } from "../lib/sync";
import { useAuthStore } from "../stores/useAuthStore";
import { useLanguageStore } from "../stores/useLanguageStore";
import { type Language, t } from "../translations";

function StatusBadge({
  status,
  lang,
}: {
  status: string;
  lang: Language;
}) {
  if (status === "pending") {
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
        {t("pendingStatus", lang)}
      </span>
    );
  }
  if (status === "synced") {
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
        {t("syncedStatus", lang)}
      </span>
    );
  }
  return (
    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
      {t("submittedStatus", lang)}
    </span>
  );
}

export function MyOrdersPage() {
  const { currentUser } = useAuthStore();
  const { lang } = useLanguageStore();
  const isOnline = useOnlineStatus();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedOrderItems, setSelectedOrderItems] = useState<OrderItem[]>([]);
  const [showDetail, setShowDetail] = useState(false);

  const loadOrders = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const [backendOrders, pendingOrders] = await Promise.all([
        isOnline
          ? getBackendActor()
              .then((actor) => actor.getOrdersByUser(currentUser.id))
              .catch(() => [])
          : Promise.resolve([]),
        getPendingOrders(),
      ]);

      // Merge, avoiding duplicates
      const backendIds = new Set(backendOrders.map((o) => o.id));
      const uniquePending = pendingOrders.filter((o) => !backendIds.has(o.id));
      setOrders(
        [...uniquePending, ...backendOrders].sort(
          (a, b) => Number(b.createdAt) - Number(a.createdAt),
        ),
      );
    } catch {
      const pending = await getPendingOrders();
      setOrders(pending);
    } finally {
      setLoading(false);
    }
  }, [currentUser, isOnline]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleSync = async () => {
    if (!currentUser || syncing) return;
    setSyncing(true);
    try {
      const { synced, failed } = await syncPendingOrders(currentUser.id);
      if (synced > 0) {
        toast.success(`${t("syncSuccess", lang)}: ${synced}`);
        await loadOrders();
      }
      if (failed > 0) {
        toast.error(`${t("syncError", lang)}: ${failed}`);
      }
    } catch {
      toast.error(t("syncError", lang));
    } finally {
      setSyncing(false);
    }
  };

  const handleViewOrder = async (order: Order) => {
    setSelectedOrder(order);
    setShowDetail(true);

    // Load items
    try {
      if (order.status === "pending") {
        const items = await getPendingOrderItems(order.id);
        setSelectedOrderItems(items);
      } else {
        // Backend doesn't have getOrderItems, use empty for now
        setSelectedOrderItems([]);
      }
    } catch {
      setSelectedOrderItems([]);
    }
  };

  const hasPending = orders.some((o) => o.status === "pending");

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-14 z-30 bg-white border-b border-border px-4 py-3 flex items-center justify-between">
        <h1 className="font-bold text-lg text-foreground">
          {t("ordersTitle", lang)}
        </h1>
        {hasPending && isOnline && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={syncing}
            className="gap-2 h-9 text-sm"
          >
            {syncing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {syncing ? t("syncing", lang) : t("syncNow", lang)}
          </Button>
        )}
      </div>

      <div className="p-4">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_item, i) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder
                key={i}
                className="bg-white rounded-xl border border-border p-4 animate-pulse"
              >
                <div className="h-4 bg-secondary rounded w-1/2 mb-2" />
                <div className="h-3 bg-secondary rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ClipboardList className="w-16 h-16 text-muted-foreground opacity-30 mb-4" />
            <p className="text-lg font-semibold text-foreground mb-2">
              {t("noOrders", lang)}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("noOrdersDesc", lang)}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
              const orderDate = new Date(
                Number(order.orderDate),
              ).toLocaleDateString("zh-CN");
              return (
                <button
                  type="button"
                  key={order.id}
                  onClick={() => handleViewOrder(order)}
                  className="w-full bg-white rounded-xl border border-border p-4 text-left hover:shadow-card-hover transition-shadow touch-manipulation"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">
                        {order.customerName}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {orderDate}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <StatusBadge status={order.status} lang={lang} />
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs text-muted-foreground">
                      {t("grandTotal", lang)}
                    </span>
                    <span className="text-base font-bold text-primary-600">
                      £{order.totalAmount.toFixed(0)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <OrderDetailModal
        open={showDetail}
        onClose={() => {
          setShowDetail(false);
          setSelectedOrder(null);
          setSelectedOrderItems([]);
        }}
        order={selectedOrder}
        items={selectedOrderItems}
      />
    </div>
  );
}
