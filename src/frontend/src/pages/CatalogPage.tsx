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
import { CustomerSelectorModal } from "../components/CustomerSelectorModal";
import { FloatingCartButton } from "../components/FloatingCartButton";
import { ProductCard } from "../components/ProductCard";
import {
  getAllCategories,
  getAllExtendedProducts,
  getProductsFromCache,
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
  const [currentPage, setCurrentPage] = useState(1);
  const [categoryMap, setCategoryMap] = useState<Record<string, string>>({}); // catId -> catEn

  // Load products — prefer extended_products (has BBD, stockStatus from bulk upload)
  useEffect(() => {
    const loadProducts = async () => {
      setLoading(true);
      try {
        const [extended, cached, allCategories] = await Promise.all([
          getAllExtendedProducts(),
          getProductsFromCache(),
          getAllCategories(),
        ]);

        // Build category map: catId -> catEn
        const map: Record<string, string> = {};
        for (const c of allCategories) {
          if (c.catId) map[c.catId] = c.catEn;
        }
        setCategoryMap(map);

        if (extended.length > 0) {
          setProducts(extended);
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

  // Filtered + sorted products (includes letter filter)
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
        return matchSearch && matchCategory && matchLetter;
      })
      .sort((a, b) => a.sku.toLowerCase().localeCompare(b.sku.toLowerCase()));
  }, [products, search, selectedCategory, selectedLetter]);

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
              {lang === "english" && categoryMap[cat] ? categoryMap[cat] : cat}
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
              <ProductCard key={product.id} product={product} />
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
    </div>
  );
}
