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
import {
  getAllExtendedProducts,
  getProductsFromCache,
  saveAllExtendedProducts,
  saveProductsToCache,
} from "../lib/db";
import { generateTemplate, parseProductsExcel } from "../lib/excel";
import { resizeImageToMaxWidth, uploadImageToBlob } from "../lib/imageUpload";
import { SAMPLE_PRODUCTS } from "../lib/sampleData";
import { useLanguageStore } from "../stores/useLanguageStore";
import { t } from "../translations";
import type { ExtendedProduct } from "../types";

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
  imageUrl: string;
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
  imageUrl: "",
};

export function ProductManagement() {
  const navigate = useNavigate();
  const { lang } = useLanguageStore();
  const isOnline = useOnlineStatus();
  const [products, setProducts] = useState<ExtendedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddEdit, setShowAddEdit] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ExtendedProduct | null>(
    null,
  );
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  // Image upload state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>("");
  const [imageUploadProgress, setImageUploadProgress] = useState(0);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      // Try extended_products store first (has all extra fields)
      const extended = await getAllExtendedProducts();
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
      imageUrl: product.imageUrl,
    });
    resetImageState();
    setShowAddEdit(true);
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setImageFile(file);
    const previewUrl = URL.createObjectURL(file);
    setImagePreviewUrl(previewUrl);
    setImageUploadProgress(0);
  };

  const handleClearImage = () => {
    setImageFile(null);
    if (imagePreviewUrl) {
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
      let finalImageUrl = form.imageUrl;

      if (imageFile) {
        setUploadingImage(true);
        try {
          const bytes = await resizeImageToMaxWidth(imageFile, 1024);
          finalImageUrl = await uploadImageToBlob(bytes, undefined, (pct) => {
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

      const now = BigInt(Date.now());
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
        imageUrl: finalImageUrl,
        createdAt: editingProduct?.createdAt ?? now,
        updatedAt: now,
      };

      if (isOnline) {
        const backendActor = await getBackendActor();
        // Save base fields to backend
        await backendActor.upsertProductBySku({
          id: product.id,
          sku: product.sku,
          nameCnSimplified: product.nameCnSimplified,
          nameCnTraditional: product.nameCnTraditional,
          category: product.category,
          price: product.price,
          stockStatus: product.stockStatus,
          imageUrl: product.imageUrl,
          createdAt: product.createdAt,
          updatedAt: product.updatedAt,
        });
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
      const baseUpdated =
        baseIdx >= 0
          ? baseCached.map((p) =>
              p.sku === product.sku
                ? {
                    id: product.id,
                    sku: product.sku,
                    nameCnSimplified: product.nameCnSimplified,
                    nameCnTraditional: product.nameCnTraditional,
                    category: product.category,
                    price: product.price,
                    stockStatus: product.stockStatus,
                    imageUrl: product.imageUrl,
                    createdAt: product.createdAt,
                    updatedAt: product.updatedAt,
                  }
                : p,
            )
          : [
              ...baseCached,
              {
                id: product.id,
                sku: product.sku,
                nameCnSimplified: product.nameCnSimplified,
                nameCnTraditional: product.nameCnTraditional,
                category: product.category,
                price: product.price,
                stockStatus: product.stockStatus,
                imageUrl: product.imageUrl,
                createdAt: product.createdAt,
                updatedAt: product.updatedAt,
              },
            ];
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
            nameEn: existingProduct?.nameEn ?? "",
            category: row.category,
            categoryId: existingProduct?.categoryId ?? "",
            brand: existingProduct?.brand ?? "",
            size: existingProduct?.size ?? "",
            bbd: existingProduct?.bbd ?? "",
            vat: existingProduct?.vat ?? 0,
            uom: existingProduct?.uom ?? "",
            stock: existingProduct?.stock ?? 0,
            promotions: existingProduct?.promotions ?? "",
            price: row.price,
            stockStatus: row.stockStatus,
            imageUrl: row.imageUrl,
            createdAt: existingProduct?.createdAt ?? now,
            updatedAt: now,
          };
          if (isOnline) {
            const backendActor = await getBackendActor();
            await backendActor.upsertProductBySku({
              id: product.id,
              sku: product.sku,
              nameCnSimplified: product.nameCnSimplified,
              nameCnTraditional: product.nameCnTraditional,
              category: product.category,
              price: product.price,
              stockStatus: product.stockStatus,
              imageUrl: product.imageUrl,
              createdAt: product.createdAt,
              updatedAt: product.updatedAt,
            });
          }
          if (existingProduct) {
            updated++;
          } else {
            created++;
          }
        } catch {
          errors++;
        }
      }

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

      <div className="p-4">
        {loading ? (
          <div
            className="flex justify-center py-16"
            data-ocid="product.loading_state"
          >
            <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          </div>
        ) : products.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-16 text-center"
            data-ocid="product.empty_state"
          >
            <Package className="w-16 h-16 text-muted-foreground opacity-30 mb-4" />
            <p className="text-muted-foreground">{t("noData", lang)}</p>
          </div>
        ) : (
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
                    <TableHead className="text-xs font-semibold text-right">
                      {t("actions", lang)}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product, index) => (
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
                        ¥{product.price}
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
            {/* Core Fields */}
            <div className="grid grid-cols-2 gap-3">
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
                <Label className="text-sm">{t("categoryId", lang)}</Label>
                <Input
                  data-ocid="product.category_id.input"
                  value={form.categoryId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, categoryId: e.target.value }))
                  }
                  placeholder="CAT-ELEC"
                />
              </div>
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
                <Input
                  data-ocid="product.category.input"
                  value={form.category}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, category: e.target.value }))
                  }
                  placeholder="電子產品"
                />
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

            {/* Image Upload Section */}
            <div className="space-y-2">
              <Label className="text-sm">{t("uploadImage", lang)}</Label>

              {/* Hidden file input */}
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
                    <button
                      type="button"
                      onClick={handleClearImage}
                      className="absolute top-2 right-2 p-1 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                      aria-label="Remove image"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
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

              {/* Manual URL input fallback */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  {t("imageUrl", lang)}
                </Label>
                <Input
                  value={form.imageUrl}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, imageUrl: e.target.value }))
                  }
                  placeholder="https://..."
                  className="h-8 text-xs"
                />
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
