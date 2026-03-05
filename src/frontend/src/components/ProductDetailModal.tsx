import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Minus, Package, Plus, Tag, X } from "lucide-react";
import { useCartStore } from "../stores/useCartStore";
import { useLanguageStore } from "../stores/useLanguageStore";
import { type Language, t } from "../translations";
import type { ExtendedProduct } from "../types";

interface ProductDetailModalProps {
  product: ExtendedProduct | null;
  open: boolean;
  onClose: () => void;
}

function StockBadge({ status, lang }: { status: string; lang: Language }) {
  if (status === "in_stock") {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-100">
        {t("inStock", lang)}
      </span>
    );
  }
  if (status === "low_stock") {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-100">
        {t("lowStock", lang)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-100">
      {t("outOfStock", lang)}
    </span>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
      <span className="text-xs font-medium text-muted-foreground w-28 flex-shrink-0 pt-0.5">
        {label}
      </span>
      <span className="text-sm text-foreground font-medium flex-1 break-words">
        {value}
      </span>
    </div>
  );
}

export function ProductDetailModal({
  product,
  open,
  onClose,
}: ProductDetailModalProps) {
  const { lang } = useLanguageStore();
  const { items, addItem, updateQty } = useCartStore();

  if (!product) return null;

  const cartItem = items.find((i) => i.productId === product.id);
  const qty = cartItem?.quantity ?? 0;
  const isOutOfStock = product.stockStatus === "out_of_stock";

  const nameEn = product.nameEn || "";
  const nameCn = product.nameCnTraditional || product.nameCnSimplified;
  const isEnglish = lang === "english";
  const primaryName = isEnglish && nameEn ? nameEn : nameCn;
  const secondaryName = isEnglish && nameEn ? nameCn : null;

  const handleAdd = () => {
    if (isOutOfStock) return;
    if (qty === 0) {
      addItem({
        productId: product.id,
        sku: product.sku,
        name: primaryName,
        unitPrice: product.price,
      });
    } else {
      updateQty(product.id, qty + 1);
    }
  };

  const handleSubtract = () => {
    updateQty(product.id, qty - 1);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent
        data-ocid="product_detail.dialog"
        className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0"
        showCloseButton={false}
      >
        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-4 border-b border-border">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-mono text-muted-foreground mb-1">
                {product.sku}
              </p>
              <DialogTitle className="text-base font-bold text-foreground leading-snug">
                {primaryName}
              </DialogTitle>
              {secondaryName && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {secondaryName}
                </p>
              )}
            </div>
            <button
              type="button"
              data-ocid="product_detail.close_button"
              onClick={onClose}
              className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <X width={16} height={16} />
            </button>
          </div>
        </DialogHeader>

        {/* Body: two-column on md+, stacked on mobile */}
        <div className="flex flex-col md:flex-row">
          {/* Left: Image */}
          <div className="md:w-64 md:flex-shrink-0 bg-white flex items-center justify-center md:min-h-64">
            {product.imageBlobUrl ? (
              <img
                src={product.imageBlobUrl}
                alt={primaryName}
                className="w-full h-64 md:h-full object-contain"
              />
            ) : (
              <div className="w-full h-56 md:h-full flex flex-col items-center justify-center text-muted-foreground gap-2 p-8">
                <Package className="w-14 h-14 opacity-20" />
                <span className="text-xs opacity-40 font-mono text-center">
                  {product.sku}
                </span>
              </div>
            )}
          </div>

          {/* Right: Details */}
          <div className="flex-1 px-5 py-4 flex flex-col gap-1 min-w-0">
            {/* Price + Stock Status row */}
            <div className="flex items-center justify-between gap-3 mb-3">
              <span className="text-2xl font-bold text-primary-600">
                £{product.price}
              </span>
              <StockBadge status={product.stockStatus} lang={lang} />
            </div>

            {/* Field rows — only show if non-empty */}
            <div className="divide-y divide-border/40">
              <DetailRow label={t("sku", lang)} value={product.sku} />
              {product.brand && (
                <DetailRow label={t("brand", lang)} value={product.brand} />
              )}
              {product.category && (
                <DetailRow
                  label={t("category", lang)}
                  value={product.category}
                />
              )}
              {product.size && (
                <DetailRow label={t("size", lang)} value={product.size} />
              )}
              {product.uom && (
                <DetailRow label={t("uom", lang)} value={product.uom} />
              )}
              {product.vat !== undefined && product.vat !== 0 && (
                <DetailRow label={t("vat", lang)} value={`${product.vat}%`} />
              )}
              {product.stock !== undefined && product.stock !== 0 && (
                <DetailRow label={t("stock", lang)} value={product.stock} />
              )}
              {product.bbd && (
                <DetailRow label={t("bbd", lang)} value={product.bbd} />
              )}
            </div>

            {/* Promotions box */}
            {product.promotions && (
              <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                <Tag className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800 font-medium">
                  {product.promotions}
                </p>
              </div>
            )}

            {/* Add to Cart Controls */}
            <div className="mt-4 pt-4 border-t border-border">
              {isOutOfStock ? (
                <div className="h-11 flex items-center justify-center rounded-lg bg-secondary text-sm text-muted-foreground font-medium">
                  {t("outOfStock", lang)}
                </div>
              ) : qty === 0 ? (
                <button
                  type="button"
                  data-ocid="product_detail.add_to_cart.button"
                  onClick={handleAdd}
                  className="w-full h-11 rounded-lg bg-primary-600 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-primary-700 active:scale-95 transition-all touch-manipulation"
                >
                  <Plus className="w-4 h-4" />
                  {t("addToCart", lang)}
                </button>
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    data-ocid="product_detail.qty_decrease.button"
                    onClick={handleSubtract}
                    className="flex items-center justify-center w-11 h-11 rounded-lg bg-secondary text-foreground hover:bg-accent active:scale-95 transition-all touch-manipulation flex-shrink-0"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="flex-1 text-center text-lg font-bold text-foreground">
                    {qty}
                  </span>
                  <button
                    type="button"
                    data-ocid="product_detail.qty_increase.button"
                    onClick={handleAdd}
                    className="flex items-center justify-center w-11 h-11 rounded-lg bg-primary-600 text-white hover:bg-primary-700 active:scale-95 transition-all touch-manipulation flex-shrink-0"
                    aria-label="Increase quantity"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
