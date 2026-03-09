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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Layers,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { Category } from "../backend.d";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { getBackendActor } from "../lib/backendService";
import {
  getAllCategories,
  saveCategoriesToCache,
  saveCategory,
} from "../lib/db";
import { generateCategoryTemplate, parseCategoriesExcel } from "../lib/excel";
import { useLanguageStore } from "../stores/useLanguageStore";
import { t } from "../translations";

interface CategoryForm {
  catId: string;
  catEn: string;
  catCn: string;
  subCat: string;
}

const emptyForm: CategoryForm = {
  catId: "",
  catEn: "",
  catCn: "",
  subCat: "",
};

export function CategoryManagement() {
  const navigate = useNavigate();
  const { lang } = useLanguageStore();
  const isOnline = useOnlineStatus();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [form, setForm] = useState<CategoryForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Bulk upload state
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResults, setUploadResults] = useState<{
    created: number;
    updated: number;
    errors: number;
  } | null>(null);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);

  const loadCategories = async () => {
    setLoading(true);
    try {
      if (isOnline) {
        // Online: fetch from backend and refresh cache
        try {
          const actor = await getBackendActor();
          const backendCats = await actor.getAllCategoriesData();
          await saveCategoriesToCache(backendCats);
          setCategories(backendCats);
          return;
        } catch {
          // Fall through to cache
        }
      }
      // Offline or backend error: use IndexedDB cache
      const cached = await getAllCategories();
      setCategories(cached);
    } catch {
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: load once on mount
  useEffect(() => {
    loadCategories();
  }, []);

  const openAdd = () => {
    setEditingCategory(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (category: Category) => {
    setEditingCategory(category);
    setForm({
      catId: category.catId,
      catEn: category.catEn,
      catCn: category.catCn,
      subCat: category.subCat,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.catId || !form.catEn) return;
    if (!isOnline) {
      toast.error(
        lang === "english"
          ? "Cannot make changes while offline"
          : "離線時無法儲存更改",
      );
      return;
    }
    setSaving(true);
    try {
      const now = BigInt(Date.now());
      const category: Category = {
        id: editingCategory?.id || crypto.randomUUID(),
        catId: form.catId,
        catEn: form.catEn,
        catCn: form.catCn,
        subCat: form.subCat,
        createdAt: editingCategory?.createdAt ?? now,
        updatedAt: now,
      };

      // Save to backend first; only update cache on success
      const actor = await getBackendActor();
      await actor.upsertCategory(category);
      await saveCategory(category);

      // Reload from DB for consistency
      const updated = await getAllCategories();
      setCategories(updated);
      setShowModal(false);
      toast.success(t("save", lang));
    } catch {
      toast.error(t("loadError", lang));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (category: Category) => {
    if (!isOnline) {
      toast.error(
        lang === "english"
          ? "Cannot make changes while offline"
          : "離線時無法儲存更改",
      );
      setDeleteConfirmId(null);
      return;
    }
    try {
      // Delete from backend first
      const actor = await getBackendActor();
      await actor.deleteCategoryData(category.catId);
      // Then remove from local cache
      const updated = (await getAllCategories()).filter(
        (c) => c.id !== category.id,
      );
      await saveCategoriesToCache(updated);
      setCategories(updated);
      toast.success(t("delete", lang));
    } catch {
      toast.error(t("loadError", lang));
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const handleBulkUpload = async () => {
    if (!uploadFile) return;
    if (!isOnline) {
      toast.error(
        lang === "english"
          ? "Cannot make changes while offline"
          : "離線時無法儲存更改",
      );
      return;
    }
    setUploading(true);
    setUploadResults(null);
    setUploadProgress(0);

    try {
      const rows = await parseCategoriesExcel(uploadFile);
      let created = 0;
      let updated = 0;
      let errors = 0;
      const existing = await getAllCategories();
      const actor = await getBackendActor();

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        setUploadProgress(Math.round(((i + 1) / rows.length) * 100));
        try {
          const now = BigInt(Date.now());
          // Match by catId
          const existingCat = existing.find(
            (c) => c.catId.toLowerCase() === row.catId.toLowerCase(),
          );
          const category: Category = {
            id: existingCat?.id || crypto.randomUUID(),
            catId: row.catId,
            catEn: row.catEn,
            catCn: row.catCn || existingCat?.catCn || "",
            subCat: row.subCat || existingCat?.subCat || "",
            createdAt: existingCat?.createdAt ?? now,
            updatedAt: now,
          };
          // Save to backend first
          await actor.upsertCategory(category);
          await saveCategory(category);
          if (existingCat) {
            updated++;
          } else {
            created++;
          }
        } catch {
          errors++;
        }
      }

      await loadCategories();
      setUploadResults({ created, updated, errors });
      // Treat file as temporary — clear reference immediately after processing
      setUploadFile(null);
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
          data-ocid="category.back_button"
          className="p-2 rounded-lg hover:bg-secondary -ml-2 touch-manipulation"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-bold text-lg flex-1">
          {t("categoryManagement", lang)}
        </h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setUploadFile(null);
              setUploadResults(null);
              setUploadProgress(0);
              setShowBulkUpload(true);
            }}
            data-ocid="category.open_modal_button"
            className="gap-1.5 h-9"
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">{t("bulkUpload", lang)}</span>
          </Button>
          <Button
            size="sm"
            onClick={openAdd}
            data-ocid="category.primary_button"
            className="gap-1.5 h-9 bg-primary-600 hover:bg-primary-700 text-white"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">{t("addCategory", lang)}</span>
          </Button>
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <div
            className="flex justify-center py-16"
            data-ocid="category.loading_state"
          >
            <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          </div>
        ) : categories.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-16 text-center"
            data-ocid="category.empty_state"
          >
            <Layers className="w-16 h-16 text-muted-foreground opacity-30 mb-4" />
            <p className="text-muted-foreground">{t("noData", lang)}</p>
            <Button
              size="sm"
              onClick={openAdd}
              className="mt-4 gap-1.5 bg-primary-600 hover:bg-primary-700 text-white"
            >
              <Plus className="w-4 h-4" />
              {t("addCategory", lang)}
            </Button>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/50">
                    <TableHead className="text-xs font-semibold">
                      {t("catId", lang)}
                    </TableHead>
                    <TableHead className="text-xs font-semibold">
                      {t("catEn", lang)}
                    </TableHead>
                    <TableHead className="text-xs font-semibold hidden sm:table-cell">
                      {t("catCn", lang)}
                    </TableHead>
                    <TableHead className="text-xs font-semibold hidden md:table-cell">
                      {t("subCat", lang)}
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-right">
                      {t("actions", lang)}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((category, index) => (
                    <TableRow
                      key={category.id}
                      data-ocid={`category.item.${index + 1}`}
                    >
                      <TableCell className="text-xs font-mono text-muted-foreground font-semibold">
                        {category.catId}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {category.catEn}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground hidden sm:table-cell">
                        {category.catCn || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground hidden md:table-cell">
                        {category.subCat || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(category)}
                            data-ocid={`category.edit_button.${index + 1}`}
                            className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors touch-manipulation"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(category.id)}
                            data-ocid={`category.delete_button.${index + 1}`}
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

      {/* Hidden file input for bulk upload */}
      <input
        ref={bulkFileInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) setUploadFile(file);
        }}
      />

      {/* Bulk Upload Modal */}
      <Dialog
        open={showBulkUpload}
        onOpenChange={(o) => !o && setShowBulkUpload(false)}
      >
        <DialogContent
          className="w-[95vw] max-w-md rounded-2xl"
          data-ocid="category.bulk_upload.dialog"
        >
          <DialogHeader>
            <DialogTitle>{t("bulkUpload", lang)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Button
              variant="outline"
              onClick={generateCategoryTemplate}
              className="w-full gap-2"
              data-ocid="category.bulk_upload.template.button"
            >
              <Upload className="w-4 h-4" />
              {t("downloadTemplate", lang)}
            </Button>

            <div className="space-y-1.5">
              <Label className="text-sm">
                {lang === "english" ? "Upload Excel File" : "上傳 Excel 檔案"}
              </Label>
              <div
                className={`flex items-center gap-3 p-3 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
                  uploadFile
                    ? "border-primary-400 bg-primary-50/40"
                    : "border-border hover:border-primary-300 hover:bg-primary-50/20"
                }`}
                onClick={() => bulkFileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ")
                    bulkFileInputRef.current?.click();
                }}
                data-ocid="category.bulk_upload.dropzone"
              >
                <Upload className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-muted-foreground truncate">
                  {uploadFile
                    ? uploadFile.name
                    : lang === "english"
                      ? "Click to select .xlsx file"
                      : "點擊選擇 .xlsx 檔案"}
                </span>
              </div>
            </div>

            {uploading && (
              <div
                className="space-y-1.5"
                data-ocid="category.bulk_upload.loading_state"
              >
                <Progress value={uploadProgress} className="h-2" />
                <p className="text-xs text-center text-muted-foreground">
                  {lang === "english"
                    ? `Processing… ${uploadProgress}%`
                    : `處理中… ${uploadProgress}%`}
                </p>
              </div>
            )}

            {uploadResults && (
              <div
                className="rounded-xl bg-secondary/60 p-3 text-sm space-y-1"
                data-ocid="category.bulk_upload.success_state"
              >
                <p className="font-semibold text-foreground">
                  {lang === "english" ? "Upload complete" : "上傳完成"}
                </p>
                <p className="text-muted-foreground">
                  {lang === "english"
                    ? `Created: ${uploadResults.created} · Updated: ${uploadResults.updated} · Errors: ${uploadResults.errors}`
                    : `新增: ${uploadResults.created} · 更新: ${uploadResults.updated} · 錯誤: ${uploadResults.errors}`}
                </p>
                <p className="text-xs text-muted-foreground pt-1 border-t border-border">
                  {lang === "english"
                    ? "File processed — no copy retained in storage."
                    : "檔案已處理完成，不會保留副本。"}
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowBulkUpload(false)}
              data-ocid="category.bulk_upload.cancel_button"
            >
              {t("cancel", lang)}
            </Button>
            <Button
              onClick={handleBulkUpload}
              disabled={!uploadFile || uploading}
              data-ocid="category.bulk_upload.submit_button"
              className="bg-primary-600 hover:bg-primary-700 text-white"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {lang === "english" ? "Uploading…" : "上傳中…"}
                </>
              ) : lang === "english" ? (
                "Upload"
              ) : (
                "上傳"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Category Modal */}
      <Dialog open={showModal} onOpenChange={(o) => !o && setShowModal(false)}>
        <DialogContent
          className="w-[95vw] max-w-md rounded-2xl max-h-[90vh] overflow-y-auto"
          data-ocid="category.dialog"
        >
          <DialogHeader>
            <DialogTitle>
              {editingCategory
                ? t("editCategory", lang)
                : t("addCategory", lang)}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm">{t("catId", lang)}</Label>
              <Input
                data-ocid="category.cat_id.input"
                value={form.catId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, catId: e.target.value }))
                }
                placeholder="CAT-ELEC"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{t("catEn", lang)}</Label>
              <Input
                data-ocid="category.cat_en.input"
                value={form.catEn}
                onChange={(e) =>
                  setForm((f) => ({ ...f, catEn: e.target.value }))
                }
                placeholder="Electronics"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{t("catCn", lang)}</Label>
              <Input
                data-ocid="category.cat_cn.input"
                value={form.catCn}
                onChange={(e) =>
                  setForm((f) => ({ ...f, catCn: e.target.value }))
                }
                placeholder="電子產品"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{t("subCat", lang)}</Label>
              <Input
                data-ocid="category.sub_cat.input"
                value={form.subCat}
                onChange={(e) =>
                  setForm((f) => ({ ...f, subCat: e.target.value }))
                }
                placeholder="Audio / Wearables"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowModal(false)}
              data-ocid="category.cancel_button"
            >
              {t("cancel", lang)}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.catId || !form.catEn}
              data-ocid="category.save_button"
              className="bg-primary-600 hover:bg-primary-700 text-white"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("saving", lang)}
                </>
              ) : (
                t("save", lang)
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteConfirmId}
        onOpenChange={(o) => !o && setDeleteConfirmId(null)}
      >
        <DialogContent
          className="w-[95vw] max-w-sm rounded-2xl"
          data-ocid="category.delete.dialog"
        >
          <DialogHeader>
            <DialogTitle>{t("deleteCategory", lang)}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            {lang === "english"
              ? "Are you sure you want to delete this category? This action cannot be undone."
              : "確定要刪除此分類嗎？此操作無法撤銷。"}
          </p>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmId(null)}
              data-ocid="category.delete.cancel_button"
            >
              {t("cancel", lang)}
            </Button>
            <Button
              variant="destructive"
              data-ocid="category.delete.confirm_button"
              onClick={() => {
                const cat = categories.find((c) => c.id === deleteConfirmId);
                if (cat) handleDelete(cat);
              }}
            >
              {t("delete", lang)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
