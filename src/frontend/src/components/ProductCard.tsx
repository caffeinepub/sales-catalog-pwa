import { Minus, Plus, ShoppingBag } from "lucide-react";
import { motion } from "motion/react";
import type { Product } from "../backend.d";
import { useCartStore } from "../stores/useCartStore";
import { useLanguageStore } from "../stores/useLanguageStore";
import { type Language, t } from "../translations";
import type { ExtendedProduct } from "../types";

interface ProductCardProps {
  product: Product;
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

export function ProductCard({ product }: ProductCardProps) {
  const { lang } = useLanguageStore();
  const { items, addItem, updateQty } = useCartStore();

  const cartItem = items.find((i) => i.productId === product.id);
  const qty = cartItem?.quantity ?? 0;
  const isOutOfStock = product.stockStatus === "out_of_stock";

  const productName = product.nameCnTraditional || product.nameCnSimplified;

  const handleAdd = () => {
    if (isOutOfStock) return;
    if (qty === 0) {
      addItem({
        productId: product.id,
        sku: product.sku,
        name: productName,
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
      <div className="aspect-square bg-secondary relative overflow-hidden">
        {(product as ExtendedProduct).imageBlobUrl ? (
          <img
            src={(product as ExtendedProduct).imageBlobUrl}
            alt={productName}
            className="w-full h-full object-cover"
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
      </div>

      {/* Card Content */}
      <div className="p-3 flex flex-col flex-1 gap-2">
        {/* SKU */}
        <p className="text-[11px] text-muted-foreground font-mono font-medium">
          {product.sku}
        </p>

        {/* Name */}
        <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2 flex-1">
          {productName}
        </p>

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
