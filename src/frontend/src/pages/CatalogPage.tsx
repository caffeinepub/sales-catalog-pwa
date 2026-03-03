import { Input } from "@/components/ui/input";
import { Search, SlidersHorizontal } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import type { Product } from "../backend.d";
import { CustomerSelectorModal } from "../components/CustomerSelectorModal";
import { FloatingCartButton } from "../components/FloatingCartButton";
import { ProductCard } from "../components/ProductCard";
import { getProductsFromCache, saveProductsToCache } from "../lib/db";
import { SAMPLE_PRODUCTS } from "../lib/sampleData";
import { useCartStore } from "../stores/useCartStore";
import { useLanguageStore } from "../stores/useLanguageStore";
import { t } from "../translations";
import type { ExtendedProduct } from "../types";

export function CatalogPage() {
  const { lang } = useLanguageStore();
  const { selectedCustomer, setCustomer } = useCartStore();

  const [showCustomerModal, setShowCustomerModal] = useState(!selectedCustomer);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Load products
  useEffect(() => {
    const loadProducts = async () => {
      setLoading(true);
      try {
        // Try cache first
        const cached = await getProductsFromCache();
        if (cached.length > 0) {
          setProducts(cached);
        } else {
          setProducts(SAMPLE_PRODUCTS);
          await saveProductsToCache(SAMPLE_PRODUCTS);
        }
      } catch {
        setProducts(SAMPLE_PRODUCTS);
      } finally {
        setLoading(false);
      }
    };
    loadProducts();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Get unique categories
  const categories = useMemo(() => {
    const cats = [...new Set(products.map((p) => p.category))];
    return cats;
  }, [products]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const name = p.nameCnTraditional || p.nameCnSimplified;
      const nameEn = (p as ExtendedProduct).nameEn ?? "";
      const matchSearch =
        search === "" ||
        name.toLowerCase().includes(search.toLowerCase()) ||
        nameEn.toLowerCase().includes(search.toLowerCase()) ||
        p.sku.toLowerCase().includes(search.toLowerCase());
      const matchCategory =
        selectedCategory === "all" || p.category === selectedCategory;
      return matchSearch && matchCategory;
    });
  }, [products, search, selectedCategory]);

  // Show customer selector if no customer selected
  useEffect(() => {
    if (!selectedCustomer) {
      setShowCustomerModal(true);
    }
  }, [selectedCustomer]);

  return (
    <div className="flex flex-col h-full">
      {/* Customer Selector Modal */}
      <CustomerSelectorModal
        open={showCustomerModal}
        onClose={() => setShowCustomerModal(false)}
      />

      {/* Sticky Header Area */}
      <div className="sticky top-14 z-30 bg-background border-b border-border px-4 pt-3 pb-3 space-y-3">
        {/* Ordering for banner */}
        {selectedCustomer && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />
              <p className="text-sm text-muted-foreground truncate">
                <span>{t("orderingFor", lang)} </span>
                <span className="font-semibold text-foreground">
                  {selectedCustomer.name}
                </span>
                <span> {t("orderingForSuffix", lang)}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setCustomer(null);
                setShowCustomerModal(true);
              }}
              className="text-xs text-primary-600 hover:text-primary-700 font-medium flex-shrink-0 ml-2 touch-manipulation"
            >
              {t("changeCustomer", lang)}
            </button>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder", lang)}
            className="pl-9 h-10 bg-white"
          />
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
          <button
            type="button"
            onClick={() => setSelectedCategory("all")}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors touch-manipulation ${
              selectedCategory === "all"
                ? "bg-primary-600 text-white"
                : "bg-white border border-border text-muted-foreground hover:bg-secondary"
            }`}
          >
            {t("allCategories", lang)}
          </button>
          {categories.map((cat) => (
            <button
              type="button"
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors touch-manipulation ${
                selectedCategory === cat
                  ? "bg-primary-600 text-white"
                  : "bg-white border border-border text-muted-foreground hover:bg-secondary"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Product Grid */}
      <div className="flex-1 p-4">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 6 }).map((_item, i) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder
                key={i}
                className="bg-white rounded-xl border border-border overflow-hidden"
              >
                <div className="aspect-square bg-secondary animate-pulse" />
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-secondary rounded animate-pulse w-16" />
                  <div className="h-4 bg-secondary rounded animate-pulse" />
                  <div className="h-4 bg-secondary rounded animate-pulse w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <SlidersHorizontal className="w-12 h-12 text-muted-foreground opacity-30 mb-3" />
            <p className="text-muted-foreground text-sm">{t("noData", lang)}</p>
          </div>
        ) : (
          <motion.div
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: {
                transition: { staggerChildren: 0.04 },
              },
            }}
          >
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </motion.div>
        )}
      </div>

      {/* Floating Cart Button */}
      <FloatingCartButton />
    </div>
  );
}
