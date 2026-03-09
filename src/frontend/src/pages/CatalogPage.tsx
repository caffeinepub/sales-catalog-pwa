import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Search, SlidersHorizontal } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import type { Product } from "../backend.d";
import { CustomerSelectorModal } from "../components/CustomerSelectorModal";
import { FloatingCartButton } from "../components/FloatingCartButton";
import { ProductCard } from "../components/ProductCard";
import { ProductDetailModal } from "../components/ProductDetailModal";
import { getBackendActor } from "../lib/backendService";
import {
  getAllCategories,
  getAllExtendedProducts,
  getProductsFromCache,
  saveAllExtendedProducts,
  saveCategoriesToCache,
  saveProductsToCache,
} from "../lib/db";
import { SAMPLE_PRODUCTS } from "../lib/sampleData";
import { useCartStore } from "../stores/useCartStore";
import { useLanguageStore } from "../stores/useLanguageStore";
import { t } from "../translations";
import type { ExtendedProduct } from "../types";

const ITEMS_PER_PAGE = 20;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export function CatalogPage() {
  const { lang } = useLanguageStore();
  const { selectedCustomer, setCustomer } = useCartStore();

  const [showCustomerModal, setShowCustomerModal] = useState(!selectedCustomer);
  const [products, setProducts] = useState<ExtendedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [stockFilter, setStockFilter] = useState<
    "all" | "in_stock" | "out_of_stock"
  >("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [categoryMap, setCategoryMap] = useState<
    Record<string, { catEn: string; catCn: string }>
  >({}); // catId -> { catEn, catCn }
  const [detailProduct, setDetailProduct] = useState<ExtendedProduct | null>(
    null,
  );

  // Load products — sync from backend first, then fall back to IndexedDB/sample
  useEffect(() => {
    const loadProducts = async () => {
      setLoading(true);
      try {
        const [extendedLocal, cached, allCategories] = await Promise.all([
          getAllExtendedProducts(),
          getProductsFromCache(),
          getAllCategories(),
        ]);

        // Build category map from local cache first
        const buildCategoryMap = (cats: typeof allCategories) => {
          const map: Record<string, { catEn: string; catCn: string }> = {};
          for (const c of cats) {
            if (c.catId) map[c.catId] = { catEn: c.catEn, catCn: c.catCn };
          }
          return map;
        };
        setCategoryMap(buildCategoryMap(allCategories));

        // Try to sync from backend canister
        let backendProducts: Product[] = [];
        let backendExtended: import("../backend.d").ExtendedProduct[] = [];
        try {
          const actor = await getBackendActor();
          [backendProducts, backendExtended] = await Promise.all([
            actor.getAllProducts(),
            actor.getAllExtendedProductsData(),
          ]);
          // Also refresh categories from backend
          const backendCats = await actor.getAllCategoriesData();
          if (backendCats.length > 0) {
            await saveCategoriesToCache(backendCats);
            setCategoryMap(buildCategoryMap(backendCats));
          }
        } catch {
          // offline or error — use local only
        }

        if (backendProducts.length > 0) {
          // Merge: backend is authoritative for base + extended fields, local for imageBlobUrl only
          const localMap = new Map(extendedLocal.map((p) => [p.sku, p]));
          const extMap = new Map(backendExtended.map((ep) => [ep.sku, ep]));

          const merged: ExtendedProduct[] = backendProducts.map((bp) => {
            const local = localMap.get(bp.sku);
            const ext = extMap.get(bp.sku);
            return {
              id: bp.id,
              sku: bp.sku,
              nameCnSimplified: bp.nameCnSimplified,
              nameCnTraditional: bp.nameCnTraditional,
              category: bp.category,
              price: bp.price,
              stockStatus: bp.stockStatus,
              imageBlobUrl: local?.imageBlobUrl ?? "",
              createdAt: bp.createdAt,
              updatedAt: bp.updatedAt,
              // Extended fields: backend first, then local cache
              categoryId: ext?.categoryId ?? local?.categoryId ?? "",
              brand: ext?.brand ?? local?.brand ?? "",
              nameEn: ext?.nameEn ?? local?.nameEn ?? "",
              size: ext?.size ?? local?.size ?? "",
              bbd: ext?.bbd ?? local?.bbd ?? "",
              vat: ext?.vat ?? local?.vat ?? 0,
              uom: ext?.uom ?? local?.uom ?? "",
              stock: ext ? Number(ext.stock) : (local?.stock ?? 0),
              promotions: ext?.promotions ?? local?.promotions ?? "",
              imageFileName: ext?.imageFileName ?? local?.imageFileName ?? "",
            };
          });
          await saveAllExtendedProducts(merged);
          setProducts(merged);
        } else if (extendedLocal.length > 0) {
          setProducts(extendedLocal);
        } else if (cached.length > 0) {
          // Promote base products to ExtendedProduct shape
          const promoted: ExtendedProduct[] = cached.map((p) => ({
            categoryId: "",
            brand: "",
            nameEn: "",
            size: "",
            bbd: "",
            vat: 0,
            uom: "",
            stock: 0,
            promotions: "",
            imageFileName: "",
            imageBlobUrl: "",
            ...p,
          }));
          setProducts(promoted);
          await saveProductsToCache(cached);
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

  // Filtered + sorted products (includes letter filter and stock filter)
  const sortedFilteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        const name = p.nameCnTraditional || p.nameCnSimplified;
        const nameEn = p.nameEn ?? "";
        const matchSearch =
          search === "" ||
          name.toLowerCase().includes(search.toLowerCase()) ||
          nameEn.toLowerCase().includes(search.toLowerCase()) ||
          p.sku.toLowerCase().includes(search.toLowerCase());
        const matchCategory =
          selectedCategory === "all" || p.category === selectedCategory;
        const matchLetter =
          !selectedLetter || p.sku.toUpperCase().startsWith(selectedLetter);
        const matchStock =
          stockFilter === "all" ||
          (stockFilter === "in_stock" &&
            (p.stockStatus === "in_stock" || p.stockStatus === "low_stock")) ||
          (stockFilter === "out_of_stock" && p.stockStatus === "out_of_stock");
        return matchSearch && matchCategory && matchLetter && matchStock;
      })
      .sort((a, b) => a.sku.toLowerCase().localeCompare(b.sku.toLowerCase()));
  }, [products, search, selectedCategory, selectedLetter, stockFilter]);

  // Pagination derived values
  const totalPages = Math.max(
    1,
    Math.ceil(sortedFilteredProducts.length / ITEMS_PER_PAGE),
  );
  const pagedProducts = sortedFilteredProducts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  // Reset to page 1 when filters change (handled inline in setters below)

  // Show customer selector if no customer selected
  useEffect(() => {
    if (!selectedCustomer) {
      setShowCustomerModal(true);
    }
  }, [selectedCustomer]);

  // Build page numbers to display (up to 5 centered on current page)
  const pageNumbers = useMemo(() => {
    const delta = 2;
    const start = Math.max(1, currentPage - delta);
    const end = Math.min(totalPages, currentPage + delta);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [currentPage, totalPages]);

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
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            placeholder={t("searchPlaceholder", lang)}
            className="pl-9 h-10 bg-white"
          />
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
          <button
            type="button"
            onClick={() => {
              setSelectedCategory("all");
              setCurrentPage(1);
            }}
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
              onClick={() => {
                setSelectedCategory(cat);
                setCurrentPage(1);
              }}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors touch-manipulation ${
                selectedCategory === cat
                  ? "bg-primary-600 text-white"
                  : "bg-white border border-border text-muted-foreground hover:bg-secondary"
              }`}
            >
              {lang === "english"
                ? (categoryMap[cat]?.catEn ?? cat)
                : categoryMap[cat]?.catCn || categoryMap[cat]?.catEn || cat}
            </button>
          ))}
        </div>

        {/* Stock Filter */}
        <div className="flex gap-2">
          {(
            [
              {
                value: "all",
                labelCn: "全部",
                labelEn: "All",
              },
              {
                value: "in_stock",
                labelCn: "有貨",
                labelEn: "In Stock",
              },
              {
                value: "out_of_stock",
                labelCn: "缺貨",
                labelEn: "Out of Stock",
              },
            ] as const
          ).map(({ value, labelCn, labelEn }) => (
            <button
              key={value}
              type="button"
              data-ocid="catalog.stock_filter.tab"
              onClick={() => {
                setStockFilter(value);
                setCurrentPage(1);
              }}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors touch-manipulation ${
                stockFilter === value
                  ? "bg-primary-600 text-white"
                  : "bg-white border border-border text-muted-foreground hover:bg-secondary"
              }`}
            >
              {lang === "english" ? labelEn : labelCn}
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
        ) : sortedFilteredProducts.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-16 text-center"
            data-ocid="catalog.empty_state"
          >
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
            {pagedProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onViewDetail={(p) => setDetailProduct(p)}
              />
            ))}
          </motion.div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="mt-6 flex flex-col items-center gap-2">
            <p className="text-xs text-muted-foreground">
              {lang === "english"
                ? `Page ${currentPage} of ${totalPages} · ${sortedFilteredProducts.length} items`
                : `第 ${currentPage} / ${totalPages} 頁 · 共 ${sortedFilteredProducts.length} 項`}
            </p>
            <Pagination>
              <PaginationContent>
                {/* Previous */}
                <PaginationItem>
                  <PaginationPrevious
                    data-ocid="catalog.pagination_prev"
                    onClick={
                      currentPage > 1
                        ? () => setCurrentPage((p) => p - 1)
                        : undefined
                    }
                    className={
                      currentPage <= 1
                        ? "pointer-events-none opacity-40"
                        : "cursor-pointer"
                    }
                  />
                </PaginationItem>

                {/* Leading ellipsis */}
                {pageNumbers[0] > 1 && (
                  <>
                    <PaginationItem>
                      <PaginationLink
                        data-ocid="catalog.page.button"
                        onClick={() => setCurrentPage(1)}
                        className="cursor-pointer"
                      >
                        1
                      </PaginationLink>
                    </PaginationItem>
                    {pageNumbers[0] > 2 && (
                      <PaginationItem>
                        <PaginationEllipsis />
                      </PaginationItem>
                    )}
                  </>
                )}

                {/* Page numbers */}
                {pageNumbers.map((page) => (
                  <PaginationItem key={page}>
                    <PaginationLink
                      data-ocid="catalog.page.button"
                      isActive={page === currentPage}
                      onClick={() => setCurrentPage(page)}
                      className="cursor-pointer"
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                ))}

                {/* Trailing ellipsis */}
                {pageNumbers[pageNumbers.length - 1] < totalPages && (
                  <>
                    {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && (
                      <PaginationItem>
                        <PaginationEllipsis />
                      </PaginationItem>
                    )}
                    <PaginationItem>
                      <PaginationLink
                        data-ocid="catalog.page.button"
                        onClick={() => setCurrentPage(totalPages)}
                        className="cursor-pointer"
                      >
                        {totalPages}
                      </PaginationLink>
                    </PaginationItem>
                  </>
                )}

                {/* Next */}
                <PaginationItem>
                  <PaginationNext
                    data-ocid="catalog.pagination_next"
                    onClick={
                      currentPage < totalPages
                        ? () => setCurrentPage((p) => p + 1)
                        : undefined
                    }
                    className={
                      currentPage >= totalPages
                        ? "pointer-events-none opacity-40"
                        : "cursor-pointer"
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}

        {/* Alphabet Filter Bar */}
        {!loading && (
          <div className="mt-4 mb-2">
            <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
              {/* All button */}
              <button
                type="button"
                data-ocid="catalog.alpha_filter.tab"
                onClick={() => {
                  setSelectedLetter(null);
                  setCurrentPage(1);
                }}
                className={`flex-shrink-0 w-8 h-8 rounded-md text-xs font-semibold transition-colors touch-manipulation ${
                  selectedLetter === null
                    ? "bg-primary-600 text-white"
                    : "bg-white border border-border text-muted-foreground hover:bg-secondary"
                }`}
              >
                All
              </button>

              {/* A–Z buttons */}
              {ALPHABET.map((letter) => (
                <button
                  type="button"
                  key={letter}
                  data-ocid="catalog.alpha_filter.tab"
                  onClick={() => {
                    setSelectedLetter(
                      selectedLetter === letter ? null : letter,
                    );
                    setCurrentPage(1);
                  }}
                  className={`flex-shrink-0 w-8 h-8 rounded-md text-xs font-semibold transition-colors touch-manipulation ${
                    selectedLetter === letter
                      ? "bg-primary-600 text-white"
                      : "bg-white border border-border text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  {letter}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Floating Cart Button */}
      <FloatingCartButton />

      {/* Product Detail Modal */}
      <ProductDetailModal
        product={detailProduct}
        open={!!detailProduct}
        onClose={() => setDetailProduct(null)}
      />
    </div>
  );
}
