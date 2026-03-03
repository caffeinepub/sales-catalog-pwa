import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Order, OrderItem } from "../backend.d";
import { useLanguageStore } from "../stores/useLanguageStore";
import { type Language, t } from "../translations";

interface OrderDetailModalProps {
  open: boolean;
  onClose: () => void;
  order: Order | null;
  items: OrderItem[];
}

function StatusBadge({ status, lang }: { status: string; lang: Language }) {
  if (status === "pending") {
    return (
      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
        {t("pendingStatus", lang)}
      </span>
    );
  }
  if (status === "synced") {
    return (
      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
        {t("syncedStatus", lang)}
      </span>
    );
  }
  return (
    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
      {t("submittedStatus", lang)}
    </span>
  );
}

export function OrderDetailModal({
  open,
  onClose,
  order,
  items,
}: OrderDetailModalProps) {
  const { lang } = useLanguageStore();
  if (!order) return null;

  const orderDate = new Date(Number(order.orderDate)).toLocaleDateString(
    "zh-CN",
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[95vw] max-w-2xl rounded-2xl p-0 gap-0 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="px-5 pt-5 pb-4 border-b border-border">
          <DialogTitle className="text-lg font-bold">
            {t("orderDetails", lang)}
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 py-4 space-y-4">
          {/* Order Info */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <span className="text-muted-foreground">{t("customer", lang)}</span>
            <span className="font-semibold">{order.customerName}</span>
            <span className="text-muted-foreground">{t("salesRep", lang)}</span>
            <span className="font-semibold">{order.salesRepName}</span>
            <span className="text-muted-foreground">
              {t("orderDate", lang)}
            </span>
            <span className="font-semibold">{orderDate}</span>
            <span className="text-muted-foreground">
              {t("orderStatus", lang)}
            </span>
            <StatusBadge status={order.status} lang={lang} />
          </div>

          {/* Items */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/50">
                  <TableHead className="text-xs">{t("sku", lang)}</TableHead>
                  <TableHead className="text-xs">
                    {t("productName", lang)}
                  </TableHead>
                  <TableHead className="text-xs text-center">
                    {t("quantity", lang)}
                  </TableHead>
                  <TableHead className="text-xs text-right">
                    {t("unitPrice", lang)}
                  </TableHead>
                  <TableHead className="text-xs text-right">
                    {t("subtotal", lang)}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {item.sku}
                    </TableCell>
                    <TableCell className="text-sm">
                      {item.productName}
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      {Number(item.quantity)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      ¥{item.unitPrice}
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold">
                      ¥{item.subtotal.toFixed(0)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-secondary/30">
                  <TableCell
                    colSpan={4}
                    className="text-right font-bold text-sm"
                  >
                    {t("grandTotal", lang)}
                  </TableCell>
                  <TableCell className="text-right font-bold text-base text-primary-600">
                    ¥{order.totalAmount.toFixed(0)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="px-5 pb-5">
          <Button onClick={onClose} variant="outline" className="w-full h-11">
            {t("close", lang)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
