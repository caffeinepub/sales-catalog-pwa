import { Minus, Plus, ShoppingBag } from "lucide-react";
import { motion } from "motion/react";
import type { Product } from "../backend.d";
import { useCartStore } from "../stores/useCartStore";
import { useLanguageStore } from "../stores/useLanguageStore";
import { type Language, t } from "../translations";
import type { ExtendedProduct } from "../types";

interface ProductCardProps {
  product: Product;
  onViewDetail?: (product: ExtendedProduct) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  电子产品: "bg-blue-50 text-blue-700",
  服装: "bg-purple-50 text-purple-700",
  食品: "bg-green-50 text-green-700",
  家居: "bg-orange-50 text-orange-700",
  运动: "bg-red-50 text-red-700",
};

function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] || "bg-gray-100 text-gray-600";
}

function StockBadge({
  status,
  lang,
}: {
  status: string;
  lang: Language;
}) {
  if (status === "in_stock") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-50 text-green-700 border border-green-100">
        {t("inStock", lang)}
      </span>
    );
  }
  if (status === "low_stock") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-100">
        {t("lowStock", lang)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-50 text-red-700 border border-red-100">
      {t("outOfStock", lang)}
    </span>
  );
}

export function ProductCard({ product, onViewDetail }: ProductCardProps) {
  const { lang } = useLanguageStore();
  const { items, addItem, updateQty } = useCartStore();

  const cartItem = items.find((i) => i.productId === product.id);
  const qty = cartItem?.quantity ?? 0;
  const isOutOfStock = product.stockStatus === "out_of_stock";

  const extProduct = product as ExtendedProduct;
  const nameEn = extProduct.nameEn || "";
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
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white rounded-xl shadow-card border border-border overflow-hidden flex flex-col transition-shadow hover:shadow-card-hover ${
        isOutOfStock ? "opacity-70" : ""
      }`}
    >
      {/* Product Image */}
      <div
        className={`aspect-square bg-secondary relative overflow-hidden ${onViewDetail ? "cursor-pointer group" : ""}`}
        onClick={
          onViewDetail
            ? () => onViewDetail(product as ExtendedProduct)
            : undefined
        }
        role={onViewDetail ? "button" : undefined}
        tabIndex={onViewDetail ? 0 : undefined}
        onKeyDown={
          onViewDetail
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onViewDetail(product as ExtendedProduct);
                }
              }
            : undefined
        }
        aria-label={
          onViewDetail ? `View details for ${primaryName}` : undefined
        }
      >
        {(product as ExtendedProduct).imageBlobUrl ? (
          <img
            src={(product as ExtendedProduct).imageBlobUrl}
            alt={primaryName}
            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-1">
            <ShoppingBag className="w-8 h-8 opacity-30" />
            <span className="text-xs opacity-40">{product.sku}</span>
          </div>
        )}
        {/* Category badge overlay */}
        <div className="absolute top-2 left-2">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold ${getCategoryColor(product.category)}`}
          >
            {product.category}
          </span>
        </div>
        {/* Hover "View" overlay — only when onViewDetail is provided */}
        {onViewDetail && (
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors duration-200 flex items-center justify-center">
            <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white/90 text-foreground text-[11px] font-semibold px-2.5 py-1 rounded-full shadow-sm">
              View
            </span>
          </div>
        )}
      </div>

      {/* Card Content */}
      <div className="p-3 flex flex-col flex-1 gap-2">
        {/* SKU */}
        <p className="text-[11px] text-muted-foreground font-mono font-medium">
          {product.sku}
        </p>

        {/* Name */}
        <div className="flex-1 flex flex-col gap-0.5">
          <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
            {primaryName}
          </p>
          {secondaryName && (
            <p className="text-[11px] text-muted-foreground leading-snug line-clamp-1">
              {secondaryName}
            </p>
          )}
        </div>

        {/* BBD */}
        {(product as ExtendedProduct).bbd ? (
          <p className="text-[10px] text-muted-foreground font-mono">
            BBD: {(product as ExtendedProduct).bbd}
          </p>
        ) : null}

        {/* Price + Stock */}
        <div className="flex items-center justify-between gap-1">
          <span className="text-base font-bold text-primary-600">
            £{product.price}
          </span>
          <StockBadge status={product.stockStatus} lang={lang} />
        </div>

        {/* Quantity Controls */}
        {isOutOfStock ? (
          <div className="h-9 flex items-center justify-center rounded-lg bg-secondary text-xs text-muted-foreground font-medium">
            {t("outOfStock", lang)}
          </div>
        ) : qty === 0 ? (
          <button
            type="button"
            onClick={handleAdd}
            className="h-9 w-full rounded-lg bg-primary-600 text-white text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-primary-700 active:scale-95 transition-all touch-manipulation"
          >
            <Plus className="w-4 h-4" />
            {t("addToCart", lang)}
          </button>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleSubtract}
              className="flex items-center justify-center w-9 h-9 rounded-lg bg-secondary text-foreground hover:bg-accent active:scale-95 transition-all touch-manipulation flex-shrink-0"
              aria-label="Decrease quantity"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="text-sm font-bold text-foreground min-w-[24px] text-center">
              {qty}
            </span>
            <button
              type="button"
              onClick={handleAdd}
              className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary-600 text-white hover:bg-primary-700 active:scale-95 transition-all touch-manipulation flex-shrink-0"
              aria-label="Increase quantity"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
