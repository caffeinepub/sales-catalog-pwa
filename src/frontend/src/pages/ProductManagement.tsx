import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  FolderOpen,
  ImageIcon,
  Loader2,
  Package,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { getBackendActor } from "../lib/backendService";
import { uploadBytesToBlob } from "../lib/blobUpload";
import {
  getAllCategories,
  getAllExtendedProducts,
  getProductsFromCache,
  saveAllExtendedProducts,
  saveProductsToCache,
} from "../lib/db";
import { generateTemplate, parseProductsExcel } from "../lib/excel";
import { resizeImageToMaxWidth } from "../lib/imageUpload";
import { SAMPLE_PRODUCTS } from "../lib/sampleData";
import { useLanguageStore } from "../stores/useLanguageStore";
import { t } from "../translations";
import type { Category, ExtendedProduct } from "../types";

interface ProductForm {
  id: string;
  sku: string;
  nameCnTraditional: string;
  nameEn: string;
  category: string;
  categoryId: string;
  brand: string;
  size: string;
  bbd: string;
  vat: string;
  uom: string;
  stock: string;
  promotions: string;
  price: string;
  stockStatus: string;
  imageFileName: string;
}

const emptyForm: ProductForm = {
  id: "",
  sku: "",
  nameCnTraditional: "",
  nameEn: "",
  category: "",
  categoryId: "",
  brand: "",
  size: "",
  bbd: "",
  vat: "0",
  uom: "",
  stock: "0",
  promotions: "",
  price: "",
  stockStatus: "in_stock",
  imageFileName: "",
};

export function ProductManagement() {
  const navigate = useNavigate();
  const { lang } = useLanguageStore();
  const isOnline = useOnlineStatus();
  const [products, setProducts] = useState<ExtendedProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddEdit, setShowAddEdit] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ExtendedProduct | null>(
    null,
  );
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  // Filter & pagination state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterLetter, setFilterLetter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  // Image upload state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>("");
  const [imageUploadProgress, setImageUploadProgress] = useState(0);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Folder upload state
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [folderUploading, setFolderUploading] = useState(false);

  // Bulk upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<{
    created: number;
    updated: number;
    errors: number;
  } | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const loadProducts = async () => {
    setLoading(true);
    try {
      // Load categories and products in parallel
      const [extended, cats] = await Promise.all([
        getAllExtendedProducts(),
        getAllCategories(),
      ]);
      setCategories(cats);

      if (extended.length > 0) {
        setProducts(extended);
      } else {
        // Fall back to base products_cache and promote to ExtendedProduct
        const cached = await getProductsFromCache();
        if (cached.length > 0) {
          const promoted: ExtendedProduct[] = cached.map((p) => ({
            ...p,
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
          }));
          setProducts(promoted);
        } else {
          setProducts(SAMPLE_PRODUCTS);
          await saveAllExtendedProducts(SAMPLE_PRODUCTS);
        }
      }
    } catch {
      setProducts(SAMPLE_PRODUCTS);
    } finally {
      setLoading(false);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: load once on mount
  useEffect(() => {
    loadProducts();
  }, []);

  // Reset page when filters change
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional page reset on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterCategory, filterLetter]);

  // Computed filtered + sorted + paginated products
  const filtered = products
    .filter((p) => {
      const matchesSearch =
        !searchQuery ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.nameCnTraditional.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.nameEn ?? "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        filterCategory === "all" ||
        p.categoryId === filterCategory ||
        p.category === filterCategory;
      const matchesLetter =
        !filterLetter || p.sku.toUpperCase().startsWith(filterLetter);
      return matchesSearch && matchesCategory && matchesLetter;
    })
    .sort((a, b) => a.sku.localeCompare(b.sku));

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  // Helper to build category label for dropdown
  const getCategoryLabel = (cat: Category): string => {
    const prefix = cat.subCat ? "-- " : "";
    if (lang === "english") return `${prefix}${cat.catEn}`;
    return `${prefix}${cat.catCn}`;
  };

  const resetImageState = () => {
    setImageFile(null);
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setImagePreviewUrl("");
    setImageUploadProgress(0);
    setUploadingImage(false);
  };

  const openAdd = () => {
    setEditingProduct(null);
    setForm(emptyForm);
    resetImageState();
    setShowAddEdit(true);
  };

  const openEdit = (product: ExtendedProduct) => {
    setEditingProduct(product);
    setForm({
      id: product.id,
      sku: product.sku,
      nameCnTraditional: product.nameCnTraditional,
      nameEn: product.nameEn ?? "",
      category: product.category,
      categoryId: product.categoryId ?? "",
      brand: product.brand ?? "",
      size: product.size ?? "",
      bbd: product.bbd ?? "",
      vat: String(product.vat ?? 0),
      uom: product.uom ?? "",
      stock: String(product.stock ?? 0),
      promotions: product.promotions ?? "",
      price: String(product.price),
      stockStatus: product.stockStatus,
      imageFileName: product.imageFileName ?? "",
    });
    // Show existing blob URL as preview if available
    if (product.imageBlobUrl) {
      setImagePreviewUrl(product.imageBlobUrl);
    } else {
      resetImageState();
    }
    setShowAddEdit(true);
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Revoke previous object URL only if it was created by us (not a blob URL from backend)
    if (imagePreviewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setImageFile(file);
    const previewUrl = URL.createObjectURL(file);
    setImagePreviewUrl(previewUrl);
    setImageUploadProgress(0);
    // Auto-fill imageFileName if empty
    if (!form.imageFileName) {
      setForm((f) => ({ ...f, imageFileName: file.name }));
    }
  };

  const handleClearImage = () => {
    setImageFile(null);
    if (imagePreviewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setImagePreviewUrl("");
    setImageUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (!form.sku || !form.nameCnTraditional) return;
    setSaving(true);
    try {
      const now = BigInt(Date.now());
      let imageBlobUrl = editingProduct?.imageBlobUrl ?? "";

      // If a new image file was selected, upload it
      if (imageFile) {
        setUploadingImage(true);
        try {
          const rawBytes = await resizeImageToMaxWidth(imageFile, 1024);
          const bytes =
            rawBytes.buffer instanceof ArrayBuffer
              ? new Uint8Array(rawBytes.buffer as ArrayBuffer)
              : new Uint8Array(rawBytes);
          // Upload directly to blob storage using our working upload pipeline
          imageBlobUrl = await uploadBytesToBlob(bytes, undefined, (pct) => {
            setImageUploadProgress(pct);
          });
          toast.success(t("imageUploaded", lang));
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          toast.error(`${t("imageUploadError", lang)}: ${msg}`);
          setUploadingImage(false);
          setSaving(false);
          return;
        } finally {
          setUploadingImage(false);
        }
      }

      const product: ExtendedProduct = {
        id: editingProduct?.id || crypto.randomUUID(),
        sku: form.sku,
        nameCnSimplified: "",
        nameCnTraditional: form.nameCnTraditional,
        nameEn: form.nameEn,
        category: form.category,
        categoryId: form.categoryId,
        brand: form.brand,
        size: form.size,
        bbd: form.bbd,
        vat: Number(form.vat),
        uom: form.uom,
        stock: Number(form.stock),
        promotions: form.promotions,
        price: Number(form.price),
        stockStatus: form.stockStatus,
        imageFileName: form.imageFileName,
        imageBlobUrl: imageBlobUrl,
        createdAt: editingProduct?.createdAt ?? now,
        updatedAt: now,
      };

      if (isOnline) {
        try {
          const backendActor = await getBackendActor();
          // Save base fields to backend (no imageBlob here — handled separately via updateProductImage)
          await backendActor.upsertProductBySku({
            id: product.id,
            sku: product.sku,
            nameCnSimplified: product.nameCnSimplified,
            nameCnTraditional: product.nameCnTraditional,
            category: product.category,
            price: product.price,
            stockStatus: product.stockStatus,
            imageBlob: undefined,
            createdAt: product.createdAt,
            updatedAt: product.updatedAt,
          });
        } catch {
          // Backend sync failed — continue with local save
        }
      }

      // Update extended_products store
      const existing = await getAllExtendedProducts();
      const idx = existing.findIndex((p) => p.sku === product.sku);
      const updated =
        idx >= 0
          ? existing.map((p) => (p.sku === product.sku ? product : p))
          : [...existing, product];
      await saveAllExtendedProducts(updated);

      // Also update base products_cache for backward compat
      const baseCached = await getProductsFromCache();
      const baseIdx = baseCached.findIndex((p) => p.sku === product.sku);
      const baseProductEntry = {
        id: product.id,
        sku: product.sku,
        nameCnSimplified: product.nameCnSimplified,
        nameCnTraditional: product.nameCnTraditional,
        category: product.category,
        price: product.price,
        stockStatus: product.stockStatus,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      };
      const baseUpdated =
        baseIdx >= 0
          ? baseCached.map((p) =>
              p.sku === product.sku ? baseProductEntry : p,
            )
          : [...baseCached, baseProductEntry];
      await saveProductsToCache(baseUpdated);

      setProducts(updated);
      setShowAddEdit(false);
      resetImageState();
      toast.success(t("save", lang));
    } catch {
      toast.error(t("loadError", lang));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (product: ExtendedProduct) => {
    const updated = products.filter((p) => p.id !== product.id);
    await saveAllExtendedProducts(updated);

    const baseCached = await getProductsFromCache();
    await saveProductsToCache(baseCached.filter((p) => p.id !== product.id));

    setProducts(updated);
    toast.success(t("delete", lang));
  };

  /**
   * Upload Image Folder: match filenames to products and store blobs.
   */
  const handleFolderUpload = async (files: FileList) => {
    if (files.length === 0) return;
    setFolderUploading(true);

    try {
      const allProducts = await getAllExtendedProducts();
      let matchedFiles = 0;
      let updatedProducts = 0;
      const updatedMap = new Map<string, ExtendedProduct>();

      for (const file of Array.from(files)) {
        const fileName = file.name.toLowerCase();
        // Find all products whose imageFileName matches this file
        const matchingProducts = allProducts.filter(
          (p) => p.imageFileName?.toLowerCase() === fileName,
        );

        if (matchingProducts.length > 0) {
          matchedFiles++;
          try {
            const rawBytes = await resizeImageToMaxWidth(file, 1024);
            const safeBytes =
              rawBytes.buffer instanceof ArrayBuffer
                ? new Uint8Array(rawBytes.buffer as ArrayBuffer)
                : new Uint8Array(rawBytes);
            if (isOnline) {
              // Upload directly to blob storage using our working pipeline
              const blobUrl = await uploadBytesToBlob(safeBytes);
              for (const product of matchingProducts) {
                const updatedProduct: ExtendedProduct = {
                  ...product,
                  imageBlobUrl: blobUrl,
                  updatedAt: BigInt(Date.now()),
                };
                updatedMap.set(product.id, updatedProduct);
                updatedProducts++;
              }
            } else {
              // Offline: just create a local object URL for display
              const localUrl = URL.createObjectURL(file);
              for (const product of matchingProducts) {
                const updatedProduct: ExtendedProduct = {
                  ...product,
                  imageBlobUrl: localUrl,
                  updatedAt: BigInt(Date.now()),
                };
                updatedMap.set(product.id, updatedProduct);
                updatedProducts++;
              }
            }
          } catch {
            // Continue processing other files even if one fails
          }
        }
      }

      if (updatedMap.size > 0) {
        // Merge updates back into full product list
        const finalProducts = allProducts.map((p) =>
          updatedMap.has(p.id) ? (updatedMap.get(p.id) as ExtendedProduct) : p,
        );
        await saveAllExtendedProducts(finalProducts);
        setProducts(finalProducts);
        toast.success(
          `Successfully matched ${matchedFiles} images to ${updatedProducts} products.`,
        );
      } else {
        toast.warning(
          "No images matched any products. Check that Image_FileName values match your file names.",
        );
      }
    } catch {
      toast.error(t("loadError", lang));
    } finally {
      setFolderUploading(false);
      // Reset folder input
      if (folderInputRef.current) {
        folderInputRef.current.value = "";
      }
    }
  };

  const handleBulkUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    setUploadResults(null);
    setUploadProgress(0);

    try {
      const rows = await parseProductsExcel(uploadFile);
      let created = 0;
      let updated = 0;
      let errors = 0;
      const existing = await getAllExtendedProducts();
      const updatedList: ExtendedProduct[] = [...existing];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        setUploadProgress(Math.round(((i + 1) / rows.length) * 100));
        try {
          const now = BigInt(Date.now());
          const existingProduct = existing.find((p) => p.sku === row.sku);
          const product: ExtendedProduct = {
            id: existingProduct?.id || crypto.randomUUID(),
            sku: row.sku,
            nameCnSimplified: "",
            nameCnTraditional: row.nameCnTraditional,
            nameEn: row.nameEn || existingProduct?.nameEn || "",
            category: row.category || existingProduct?.category || "",
            categoryId: row.categoryId || existingProduct?.categoryId || "",
            brand: row.brand || existingProduct?.brand || "",
            size: row.size || existingProduct?.size || "",
            bbd: row.bbd || existingProduct?.bbd || "",
            vat: row.vat ?? existingProduct?.vat ?? 0,
            uom: row.uom || existingProduct?.uom || "",
            stock: row.stock ?? existingProduct?.stock ?? 0,
            promotions: row.promotions ?? existingProduct?.promotions ?? "",
            price: row.price,
            stockStatus: row.stockStatus,
            imageFileName:
              row.imageFileName || existingProduct?.imageFileName || "",
            imageBlobUrl: existingProduct?.imageBlobUrl ?? "",
            createdAt: existingProduct?.createdAt ?? now,
            updatedAt: now,
          };
          if (isOnline) {
            try {
              const backendActor = await getBackendActor();
              await backendActor.upsertProductBySku({
                id: product.id,
                sku: product.sku,
                nameCnSimplified: product.nameCnSimplified,
                nameCnTraditional: product.nameCnTraditional,
                category: product.category,
                price: product.price,
                stockStatus: product.stockStatus,
                imageBlob: undefined,
                createdAt: product.createdAt,
                updatedAt: product.updatedAt,
              });
            } catch {
              // Backend sync failed — continue with local save
            }
          }
          const idx = updatedList.findIndex((p) => p.sku === product.sku);
          if (idx >= 0) {
            updatedList[idx] = product;
            updated++;
          } else {
            updatedList.push(product);
            created++;
          }
        } catch {
          errors++;
        }
      }

      await saveAllExtendedProducts(updatedList);
      await loadProducts();
      setUploadResults({ created, updated, errors });
    } catch {
      toast.error(t("loadError", lang));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-14 z-30 bg-white border-b border-border px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate("/admin")}
          className="p-2 rounded-lg hover:bg-secondary -ml-2 touch-manipulation"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-bold text-lg flex-1">
          {t("productManagement", lang)}
        </h1>
        <div className="flex gap-2">
          {/* Hidden folder/multi-file input */}
          <input
            ref={folderInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleFolderUpload(e.target.files);
              }
            }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => folderInputRef.current?.click()}
            disabled={folderUploading}
            data-ocid="product.folder_upload.upload_button"
            className="gap-1.5 h-9"
          >
            {folderUploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FolderOpen className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">
              {folderUploading ? t("processing", lang) : "Upload Image Folder"}
            </span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowBulkUpload(true)}
            data-ocid="product.open_modal_button"
            className="gap-1.5 h-9"
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">{t("bulkUpload", lang)}</span>
          </Button>
          <Button
            size="sm"
            onClick={openAdd}
            data-ocid="product.primary_button"
            className="gap-1.5 h-9 bg-primary-600 hover:bg-primary-700 text-white"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">{t("addProduct", lang)}</span>
          </Button>
        </div>
      </div>

      {/* Search + Category Filter Bar */}
      <div className="px-4 pt-4 pb-2 flex flex-col sm:flex-row gap-2">
        <Input
          data-ocid="product.search_input"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={
            lang === "english" ? "Search by SKU or name…" : "按貨號或名稱搜尋…"
          }
          className="flex-1"
        />
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger
            data-ocid="product.category_filter.select"
            className="w-full sm:w-52"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {lang === "english" ? "All Categories" : "所有類別"}
            </SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.catId}>
                {getCategoryLabel(cat)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="px-4 pb-4">
        {loading ? (
          <div
            className="flex justify-center py-16"
            data-ocid="product.loading_state"
          >
            <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          </div>
        ) : (
          <>
            {filtered.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center py-16 text-center"
                data-ocid="product.empty_state"
              >
                <Package className="w-16 h-16 text-muted-foreground opacity-30 mb-4" />
                <p className="text-muted-foreground">{t("noData", lang)}</p>
              </div>
            ) : (
              <>
                <div className="bg-white rounded-xl border border-border overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-secondary/50">
                          <TableHead className="text-xs font-semibold">
                            {t("sku", lang)}
                          </TableHead>
                          <TableHead className="text-xs font-semibold">
                            {t("nameCnTraditional", lang)} / {t("nameEn", lang)}
                          </TableHead>
                          <TableHead className="text-xs font-semibold hidden sm:table-cell">
                            {t("brand", lang)}
                          </TableHead>
                          <TableHead className="text-xs font-semibold hidden sm:table-cell">
                            {t("category", lang)}
                          </TableHead>
                          <TableHead className="text-xs font-semibold hidden md:table-cell">
                            {t("stock", lang)}
                          </TableHead>
                          <TableHead className="text-xs font-semibold text-right">
                            {t("price", lang)}
                          </TableHead>
                          <TableHead className="text-xs font-semibold hidden lg:table-cell">
                            {t("stockStatus", lang)}
                          </TableHead>
                          <TableHead className="text-xs font-semibold hidden xl:table-cell">
                            Image_FileName
                          </TableHead>
                          <TableHead className="text-xs font-semibold text-right">
                            {t("actions", lang)}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginated.map((product, index) => (
                          <TableRow
                            key={product.id}
                            data-ocid={`product.item.${index + 1}`}
                          >
                            <TableCell className="text-xs font-mono text-muted-foreground">
                              {product.sku}
                            </TableCell>
                            <TableCell className="max-w-[140px]">
                              <p className="text-sm font-medium truncate">
                                {product.nameCnTraditional}
                              </p>
                              {product.nameEn && (
                                <p className="text-xs text-muted-foreground truncate">
                                  {product.nameEn}
                                </p>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground hidden sm:table-cell">
                              {product.brand || "—"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground hidden sm:table-cell">
                              {product.category}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground hidden md:table-cell">
                              {product.stock ?? 0}
                            </TableCell>
                            <TableCell className="text-right text-sm font-semibold">
                              £{product.price}
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              <span
                                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                  product.stockStatus === "in_stock"
                                    ? "bg-green-50 text-green-700"
                                    : product.stockStatus === "low_stock"
                                      ? "bg-amber-50 text-amber-700"
                                      : "bg-red-50 text-red-700"
                                }`}
                              >
                                {product.stockStatus === "in_stock"
                                  ? t("inStock", lang)
                                  : product.stockStatus === "low_stock"
                                    ? t("lowStock", lang)
                                    : t("outOfStock", lang)}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground hidden xl:table-cell max-w-[120px]">
                              <span
                                className="truncate block"
                                title={product.imageFileName}
                              >
                                {product.imageFileName || "—"}
                              </span>
                              {product.imageBlobUrl && (
                                <span className="text-green-600 text-[10px]">
                                  ✓ Image
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => openEdit(product)}
                                  data-ocid={`product.edit_button.${index + 1}`}
                                  className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors touch-manipulation"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(product)}
                                  data-ocid={`product.delete_button.${index + 1}`}
                                  className="p-1.5 rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors touch-manipulation"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-1 mt-4 flex-wrap">
                    <button
                      type="button"
                      data-ocid="product.pagination_prev"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      ‹
                    </button>
                    {(() => {
                      const pages: (number | "…")[] = [];
                      if (totalPages <= 7) {
                        for (let i = 1; i <= totalPages; i++) pages.push(i);
                      } else {
                        pages.push(1);
                        if (currentPage > 3) pages.push("…");
                        for (
                          let i = Math.max(2, currentPage - 1);
                          i <= Math.min(totalPages - 1, currentPage + 1);
                          i++
                        ) {
                          pages.push(i);
                        }
                        if (currentPage < totalPages - 2) pages.push("…");
                        pages.push(totalPages);
                      }
                      return pages.map((p, i) =>
                        p === "…" ? (
                          <span
                            // biome-ignore lint/suspicious/noArrayIndexKey: static ellipsis positions
                            key={`ellipsis-${i}`}
                            className="px-2 py-1.5 text-sm text-muted-foreground"
                          >
                            …
                          </span>
                        ) : (
                          <button
                            type="button"
                            key={p}
                            data-ocid={`product.page_button.${p}`}
                            onClick={() => setCurrentPage(p)}
                            className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                              currentPage === p
                                ? "bg-primary text-primary-foreground border-primary"
                                : "border-border hover:bg-secondary"
                            }`}
                          >
                            {p}
                          </button>
                        ),
                      );
                    })()}
                    <button
                      type="button"
                      data-ocid="product.pagination_next"
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={currentPage === totalPages}
                      className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      ›
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Alphabet Strip — always visible */}
            <div className="mt-4 flex flex-wrap items-center gap-1 justify-center">
              <button
                type="button"
                data-ocid="product.alpha_filter_all.button"
                onClick={() => setFilterLetter("")}
                className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors ${
                  !filterLetter
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border hover:bg-secondary text-muted-foreground"
                }`}
              >
                All
              </button>
              {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((letter) => (
                <button
                  type="button"
                  key={letter}
                  data-ocid={`product.alpha_filter.${letter.toLowerCase()}`}
                  onClick={() =>
                    setFilterLetter((prev) => (prev === letter ? "" : letter))
                  }
                  className={`w-7 h-7 text-xs font-medium rounded-md border transition-colors ${
                    filterLetter === letter
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border hover:bg-secondary text-muted-foreground"
                  }`}
                >
                  {letter}
                </button>
              ))}
            </div>

            {/* Page info — always visible */}
            <p className="text-xs text-center text-muted-foreground mt-2">
              {filtered.length === 0
                ? lang === "english"
                  ? "No products found"
                  : "找不到產品"
                : lang === "english"
                  ? `Showing ${(currentPage - 1) * ITEMS_PER_PAGE + 1}–${Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} of ${filtered.length} products`
                  : `顯示第 ${(currentPage - 1) * ITEMS_PER_PAGE + 1}–${Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} 項，共 ${filtered.length} 項`}
            </p>
          </>
        )}
      </div>

      {/* Add/Edit Product Modal */}
      <Dialog
        open={showAddEdit}
        onOpenChange={(o) => {
          if (!o) {
            resetImageState();
            setShowAddEdit(false);
          }
        }}
      >
        <DialogContent
          className="w-[95vw] max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto"
          data-ocid="product.dialog"
        >
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? t("editProduct", lang) : t("addProduct", lang)}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {/* Product ID — read-only */}
            <div className="space-y-1.5">
              <Label className="text-sm">
                {lang === "english" ? "Product ID" : "產品 ID"}
              </Label>
              <Input
                data-ocid="product.id.input"
                value={editingProduct?.id || ""}
                placeholder={lang === "english" ? "Auto-generated" : "自動產生"}
                disabled
                className="bg-secondary text-muted-foreground cursor-not-allowed"
              />
            </div>

            {/* Core Fields */}
            <div className="space-y-1.5">
              <Label className="text-sm">{t("sku", lang)}</Label>
              <Input
                data-ocid="product.input"
                value={form.sku}
                onChange={(e) =>
                  setForm((f) => ({ ...f, sku: e.target.value }))
                }
                placeholder="ELEC-001"
                disabled={!!editingProduct}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">{t("nameCnTraditional", lang)}</Label>
              <Input
                data-ocid="product.name_cn.input"
                value={form.nameCnTraditional}
                onChange={(e) =>
                  setForm((f) => ({ ...f, nameCnTraditional: e.target.value }))
                }
                placeholder="繁體中文名稱"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">{t("nameEn", lang)}</Label>
              <Input
                data-ocid="product.name_en.input"
                value={form.nameEn}
                onChange={(e) =>
                  setForm((f) => ({ ...f, nameEn: e.target.value }))
                }
                placeholder="English product name"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">{t("brand", lang)}</Label>
                <Input
                  data-ocid="product.brand.input"
                  value={form.brand}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, brand: e.target.value }))
                  }
                  placeholder="Brand name"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">{t("category", lang)}</Label>
                {/* Category_ID is hidden — set programmatically from dropdown */}
                <Select
                  value={form.categoryId || form.category || ""}
                  onValueChange={(catId) => {
                    const cat = categories.find((c) => c.catId === catId);
                    if (cat) {
                      setForm((f) => ({
                        ...f,
                        category: cat.catEn,
                        categoryId: cat.catId,
                      }));
                    }
                  }}
                >
                  <SelectTrigger data-ocid="product.category.select">
                    <SelectValue
                      placeholder={
                        categories.length === 0
                          ? lang === "english"
                            ? "No categories available"
                            : "暫無類別"
                          : lang === "english"
                            ? "Select category"
                            : "選擇類別"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.length === 0 ? (
                      <SelectItem value="_none" disabled>
                        {lang === "english"
                          ? "No categories available"
                          : "暫無類別"}
                      </SelectItem>
                    ) : (
                      categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.catId}>
                          {getCategoryLabel(cat)}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">{t("size", lang)}</Label>
                <Input
                  data-ocid="product.size.input"
                  value={form.size}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, size: e.target.value }))
                  }
                  placeholder="100g / M / 500ml"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">{t("uom", lang)}</Label>
                <Input
                  data-ocid="product.uom.input"
                  value={form.uom}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, uom: e.target.value }))
                  }
                  placeholder="PCS / BOX / KG"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">{t("price", lang)}</Label>
                <Input
                  data-ocid="product.price.input"
                  type="number"
                  value={form.price}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, price: e.target.value }))
                  }
                  placeholder="99.00"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">{t("vat", lang)} (%)</Label>
                <Input
                  data-ocid="product.vat.input"
                  type="number"
                  step="0.01"
                  value={form.vat}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, vat: e.target.value }))
                  }
                  placeholder="0"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">{t("stock", lang)}</Label>
                <Input
                  data-ocid="product.stock.input"
                  type="number"
                  value={form.stock}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, stock: e.target.value }))
                  }
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">{t("bbd", lang)}</Label>
                <Input
                  data-ocid="product.bbd.input"
                  type="date"
                  value={form.bbd}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, bbd: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">{t("stockStatus", lang)}</Label>
              <Select
                value={form.stockStatus}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, stockStatus: v }))
                }
              >
                <SelectTrigger data-ocid="product.status.select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_stock">{t("inStock", lang)}</SelectItem>
                  <SelectItem value="low_stock">
                    {t("lowStock", lang)}
                  </SelectItem>
                  <SelectItem value="out_of_stock">
                    {t("outOfStock", lang)}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">{t("promotions", lang)}</Label>
              <Textarea
                data-ocid="product.promotions.textarea"
                value={form.promotions}
                onChange={(e) =>
                  setForm((f) => ({ ...f, promotions: e.target.value }))
                }
                placeholder="e.g. Buy 2 Get 10% Off"
                className="resize-none h-16 text-sm"
              />
            </div>

            {/* Image Section */}
            <div className="space-y-2">
              <Label className="text-sm">{t("uploadImage", lang)}</Label>

              {/* Hidden single file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageFileChange}
              />

              {/* Image preview / dropzone */}
              <div
                data-ocid="product.dropzone"
                className={`relative rounded-xl border-2 border-dashed transition-colors overflow-hidden ${
                  imagePreviewUrl
                    ? "border-primary-300 bg-primary-50/30"
                    : "border-border bg-secondary/30 hover:border-primary-300 hover:bg-primary-50/20"
                }`}
              >
                {imagePreviewUrl ? (
                  <div className="relative">
                    <img
                      src={imagePreviewUrl}
                      alt="Preview"
                      className="w-full h-40 object-cover rounded-xl"
                    />
                    {imageFile && (
                      <button
                        type="button"
                        onClick={handleClearImage}
                        className="absolute top-2 right-2 p-1 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                        aria-label="Remove image"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    data-ocid="product.upload_button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex flex-col items-center justify-center gap-2 py-8 px-4 text-muted-foreground hover:text-foreground transition-colors touch-manipulation"
                  >
                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                    <span className="text-sm font-medium">
                      {t("selectImage", lang)}
                    </span>
                    <span className="text-xs opacity-60">
                      JPG, PNG, WebP · max 1024px
                    </span>
                  </button>
                )}
              </div>

              {/* Select image button when preview is showing */}
              {imagePreviewUrl && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  data-ocid="product.upload_button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full gap-2 h-8 text-xs"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  {t("selectImage", lang)}
                </Button>
              )}

              {/* Upload progress */}
              {uploadingImage && (
                <div className="space-y-1.5" data-ocid="product.loading_state">
                  <Progress value={imageUploadProgress} className="h-1.5" />
                  <p className="text-xs text-center text-muted-foreground">
                    {t("uploadingImage", lang)} {imageUploadProgress}%
                  </p>
                </div>
              )}

              {/* Image_FileName text field */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Image_FileName</Label>
                <Input
                  data-ocid="product.image_filename.input"
                  value={form.imageFileName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, imageFileName: e.target.value }))
                  }
                  placeholder="e.g. product-001.jpg"
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Used by "Upload Image Folder" to match images to products.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                resetImageState();
                setShowAddEdit(false);
              }}
              data-ocid="product.cancel_button"
            >
              {t("cancel", lang)}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || uploadingImage}
              data-ocid="product.save_button"
              className="bg-primary-600 hover:bg-primary-700 text-white"
            >
              {saving || uploadingImage ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {uploadingImage
                    ? t("uploadingImage", lang)
                    : t("saving", lang)}
                </>
              ) : (
                t("save", lang)
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Upload Modal */}
      <Dialog
        open={showBulkUpload}
        onOpenChange={(o) => !o && setShowBulkUpload(false)}
      >
        <DialogContent className="w-[95vw] max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>{t("bulkUpload", lang)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Button
              variant="outline"
              onClick={generateTemplate}
              className="w-full gap-2"
            >
              <Upload className="w-4 h-4" />
              {t("downloadTemplate", lang)}
            </Button>

            <div className="space-y-1.5">
              <Label className="text-sm">{t("uploadExcel", lang)}</Label>
              <Input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                className="cursor-pointer"
              />
            </div>

            {uploading && (
              <div className="space-y-2">
                <Progress value={uploadProgress} />
                <p className="text-xs text-center text-muted-foreground">
                  {t("processing", lang)} {uploadProgress}%
                </p>
              </div>
            )}

            {uploadResults && (
              <div className="bg-secondary rounded-lg p-4 text-sm space-y-1">
                <p className="font-semibold">{t("uploadResults", lang)}:</p>
                <p className="text-green-700">
                  ✓ {t("created", lang)}: {uploadResults.created}
                </p>
                <p className="text-blue-700">
                  ↻ {t("updated", lang)}: {uploadResults.updated}
                </p>
                {uploadResults.errors > 0 && (
                  <p className="text-red-700">
                    ✗ {t("errors", lang)}: {uploadResults.errors}
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowBulkUpload(false)}>
              {t("cancel", lang)}
            </Button>
            <Button
              onClick={handleBulkUpload}
              disabled={!uploadFile || uploading}
              className="bg-primary-600 hover:bg-primary-700 text-white"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("processing", lang)}
                </>
              ) : (
                t("uploadExcel", lang)
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
