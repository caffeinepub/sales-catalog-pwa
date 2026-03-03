import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Loader2, ShoppingCart, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Order, OrderItem } from "../backend.d";
import { SuccessModal } from "../components/SuccessModal";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { getBackendActor } from "../lib/backendService";
import { savePendingOrder } from "../lib/db";
import { downloadExcel, generateOrderExcel } from "../lib/excel";
import { useAuthStore } from "../stores/useAuthStore";
import { useCartStore } from "../stores/useCartStore";
import { useLanguageStore } from "../stores/useLanguageStore";
import { t } from "../translations";

export function CartPage() {
  const navigate = useNavigate();
  const { lang } = useLanguageStore();
  const { currentUser } = useAuthStore();
  const { items, selectedCustomer, clear, total, updateQty, removeItem } =
    useCartStore();
  const isOnline = useOnlineStatus();
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  const totalAmount = total();
  const today = new Date().toLocaleDateString("zh-CN");

  const handleSubmit = async () => {
    if (!selectedCustomer || !currentUser || items.length === 0) return;
    setSubmitting(true);

    try {
      const orderId = crypto.randomUUID();
      const now = BigInt(Date.now());

      const order: Order = {
        id: orderId,
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
        salesRepId: currentUser.id,
        salesRepName: currentUser.name,
        orderDate: now,
        status: isOnline ? "submitted" : "pending",
        totalAmount,
        createdAt: now,
      };

      const orderItems: OrderItem[] = items.map((item, _idx) => ({
        id: crypto.randomUUID(),
        orderId,
        productId: item.productId,
        sku: item.sku,
        productName: item.name,
        quantity: BigInt(item.quantity),
        unitPrice: item.unitPrice,
        subtotal: item.unitPrice * item.quantity,
      }));

      // 1. Generate & download Excel
      const excelBlob = generateOrderExcel({
        orderDate: today,
        salesRepName: currentUser.name,
        customerName: selectedCustomer.name,
        items,
        total: totalAmount,
      });
      downloadExcel(
        excelBlob,
        `order-${selectedCustomer.name}-${today.replace(/\//g, "-")}.xlsx`,
      );

      // 2. Submit or save offline
      if (isOnline) {
        try {
          const backendActor = await getBackendActor();
          await backendActor.submitOrder(order, orderItems);
          await backendActor.incrementUserOrderCount(currentUser.id);
          setWasOffline(false);
        } catch {
          // Backend failed, save offline
          await savePendingOrder(order, orderItems);
          setWasOffline(true);
        }
      } else {
        await savePendingOrder(order, orderItems);
        setWasOffline(true);
      }

      clear();
      setShowSuccess(true);
    } catch (err) {
      console.error("Submit error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  if (items.length === 0 && !showSuccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
        <ShoppingCart className="w-16 h-16 text-muted-foreground opacity-30 mb-4" />
        <p className="text-lg font-semibold text-foreground mb-2">
          {t("cartEmpty", lang)}
        </p>
        <p className="text-sm text-muted-foreground mb-6">
          {t("cartEmptyDesc", lang)}
        </p>
        <Button
          onClick={() => navigate("/catalog")}
          className="bg-primary-600 hover:bg-primary-700 text-white"
        >
          {t("backToCatalog", lang)}
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-8">
      {/* Header */}
      <div className="sticky top-14 z-30 bg-white border-b border-border px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate("/catalog")}
          className="p-2 rounded-lg hover:bg-secondary transition-colors -ml-2 touch-manipulation"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-semibold text-lg text-foreground flex-1">
          {t("cart", lang)}
        </h1>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Order Summary Header */}
        <div className="bg-white rounded-xl border border-border p-4 space-y-2">
          <h2 className="font-semibold text-base text-foreground">
            {t("orderSummary", lang)}
          </h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <span className="text-muted-foreground">{t("customer", lang)}</span>
            <span className="font-medium text-foreground">
              {selectedCustomer?.name}
            </span>
            <span className="text-muted-foreground">{t("salesRep", lang)}</span>
            <span className="font-medium text-foreground">
              {currentUser?.name}
            </span>
            <span className="text-muted-foreground">
              {t("orderDate", lang)}
            </span>
            <span className="font-medium text-foreground">{today}</span>
          </div>
        </div>

        {/* Items Table - Desktop */}
        <div className="bg-white rounded-xl border border-border overflow-hidden hidden sm:block">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/50">
                <TableHead className="text-xs font-semibold">
                  {t("sku", lang)}
                </TableHead>
                <TableHead className="text-xs font-semibold">
                  {t("productName", lang)}
                </TableHead>
                <TableHead className="text-xs font-semibold text-center">
                  {t("quantity", lang)}
                </TableHead>
                <TableHead className="text-xs font-semibold text-right">
                  {t("unitPrice", lang)}
                </TableHead>
                <TableHead className="text-xs font-semibold text-right">
                  {t("subtotal", lang)}
                </TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.productId}>
                  <TableCell className="text-xs font-mono text-muted-foreground">
                    {item.sku}
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {item.name}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          updateQty(item.productId, item.quantity - 1)
                        }
                        className="w-7 h-7 rounded-md bg-secondary flex items-center justify-center text-xs hover:bg-accent transition-colors touch-manipulation"
                      >
                        −
                      </button>
                      <span className="text-sm font-bold w-8 text-center">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          updateQty(item.productId, item.quantity + 1)
                        }
                        className="w-7 h-7 rounded-md bg-primary-50 text-primary-700 flex items-center justify-center text-xs hover:bg-primary-100 transition-colors touch-manipulation"
                      >
                        +
                      </button>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    ¥{item.unitPrice}
                  </TableCell>
                  <TableCell className="text-right text-sm font-semibold">
                    ¥{(item.unitPrice * item.quantity).toFixed(0)}
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => removeItem(item.productId)}
                      className="p-1.5 rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors touch-manipulation"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-secondary/30">
                <TableCell colSpan={4} className="text-right font-bold text-sm">
                  {t("grandTotal", lang)}
                </TableCell>
                <TableCell className="text-right font-bold text-base text-primary-600">
                  ¥{totalAmount.toFixed(0)}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {/* Items List - Mobile */}
        <div className="sm:hidden space-y-2">
          {items.map((item) => (
            <div
              key={item.productId}
              className="bg-white rounded-xl border border-border p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono text-muted-foreground">
                    {item.sku}
                  </p>
                  <p className="text-sm font-semibold text-foreground mt-0.5">
                    {item.name}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    ¥{item.unitPrice} × {item.quantity} ={" "}
                    <span className="font-bold text-foreground">
                      ¥{(item.unitPrice * item.quantity).toFixed(0)}
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(item.productId)}
                  className="p-2 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors touch-manipulation"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-3 mt-3">
                <button
                  type="button"
                  onClick={() => updateQty(item.productId, item.quantity - 1)}
                  className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center text-sm hover:bg-accent transition-colors touch-manipulation"
                >
                  −
                </button>
                <span className="text-base font-bold min-w-[32px] text-center">
                  {item.quantity}
                </span>
                <button
                  type="button"
                  onClick={() => updateQty(item.productId, item.quantity + 1)}
                  className="w-9 h-9 rounded-lg bg-primary-50 text-primary-700 flex items-center justify-center text-sm hover:bg-primary-100 transition-colors touch-manipulation"
                >
                  +
                </button>
              </div>
            </div>
          ))}
          {/* Total */}
          <div className="bg-white rounded-xl border border-border p-4 flex items-center justify-between">
            <span className="font-bold text-sm text-muted-foreground">
              {t("grandTotal", lang)}
            </span>
            <span className="font-bold text-xl text-primary-600">
              ¥{totalAmount.toFixed(0)}
            </span>
          </div>
        </div>

        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          disabled={submitting || items.length === 0}
          className="w-full h-12 bg-primary-600 hover:bg-primary-700 text-white font-bold text-base rounded-xl"
        >
          {submitting ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              {t("submittingOrder", lang)}
            </>
          ) : (
            t("submitOrder", lang)
          )}
        </Button>
      </div>

      {/* Success Modal */}
      <SuccessModal
        open={showSuccess}
        wasOffline={wasOffline}
        onContinue={() => {
          setShowSuccess(false);
          navigate("/catalog");
        }}
      />
    </div>
  );
}
