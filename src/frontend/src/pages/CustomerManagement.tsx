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
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Upload,
  UserCheck,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { getCustomersFromCache, saveCustomersToCache } from "../lib/db";
import { generateCustomerTemplate, parseCustomersExcel } from "../lib/excel";
import { SAMPLE_CUSTOMERS } from "../lib/sampleData";
import { useLanguageStore } from "../stores/useLanguageStore";
import { t } from "../translations";
import type { Customer } from "../types";

interface CustomerForm {
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
}

const emptyForm: CustomerForm = {
  name: "",
  contactPerson: "",
  phone: "",
  email: "",
  address: "",
};

export function CustomerManagement() {
  const navigate = useNavigate();
  const { lang } = useLanguageStore();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [saving, setSaving] = useState(false);

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

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const cached = await getCustomersFromCache();
      setCustomers(cached.length > 0 ? cached : SAMPLE_CUSTOMERS);
      if (cached.length === 0) {
        await saveCustomersToCache(SAMPLE_CUSTOMERS);
      }
    } catch {
      setCustomers(SAMPLE_CUSTOMERS);
    } finally {
      setLoading(false);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: load once on mount
  useEffect(() => {
    loadCustomers();
  }, []);

  const openAdd = () => {
    setEditingCustomer(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setForm({
      name: customer.name,
      contactPerson: customer.contactPerson,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      const now = BigInt(Date.now());
      const customer: Customer = {
        id: editingCustomer?.id || crypto.randomUUID(),
        name: form.name,
        contactPerson: form.contactPerson,
        phone: form.phone,
        email: form.email,
        address: form.address,
        createdAt: editingCustomer?.createdAt ?? now,
      };

      const existing = await getCustomersFromCache();
      const idx = existing.findIndex((c) => c.id === customer.id);
      const updated =
        idx >= 0
          ? existing.map((c) => (c.id === customer.id ? customer : c))
          : [...existing, customer];
      await saveCustomersToCache(updated);
      setCustomers(updated);
      setShowModal(false);
      toast.success(t("save", lang));
    } catch {
      toast.error(t("loadError", lang));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (customer: Customer) => {
    const existing = await getCustomersFromCache();
    const updated = existing.filter((c) => c.id !== customer.id);
    await saveCustomersToCache(updated);
    setCustomers(updated);
    toast.success(t("delete", lang));
  };

  const handleBulkUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    setUploadResults(null);
    setUploadProgress(0);

    try {
      const rows = await parseCustomersExcel(uploadFile);
      let created = 0;
      let updated = 0;
      let errors = 0;
      const existing = await getCustomersFromCache();
      const updatedList: Customer[] = [...existing];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        setUploadProgress(Math.round(((i + 1) / rows.length) * 100));
        try {
          const now = BigInt(Date.now());
          // Match by name (case-insensitive)
          const existingCustomer = existing.find(
            (c) => c.name.toLowerCase() === row.name.toLowerCase(),
          );
          const customer: Customer = {
            id: existingCustomer?.id || crypto.randomUUID(),
            name: row.name,
            contactPerson:
              row.contactPerson || existingCustomer?.contactPerson || "",
            phone: row.phone || existingCustomer?.phone || "",
            email: row.email || existingCustomer?.email || "",
            address: row.address || existingCustomer?.address || "",
            createdAt: existingCustomer?.createdAt ?? now,
          };
          const idx = updatedList.findIndex((c) => c.id === customer.id);
          if (idx >= 0) {
            updatedList[idx] = customer;
            updated++;
          } else {
            updatedList.push(customer);
            created++;
          }
        } catch {
          errors++;
        }
      }

      await saveCustomersToCache(updatedList);
      await loadCustomers();
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
          className="p-2 rounded-lg hover:bg-secondary -ml-2 touch-manipulation"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-bold text-lg flex-1">
          {t("customerManagement", lang)}
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
            data-ocid="customer.open_modal_button"
            className="gap-1.5 h-9"
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">{t("bulkUpload", lang)}</span>
          </Button>
          <Button
            size="sm"
            onClick={openAdd}
            data-ocid="customer.primary_button"
            className="gap-1.5 h-9 bg-primary-600 hover:bg-primary-700 text-white"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">{t("addCustomer", lang)}</span>
          </Button>
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          </div>
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <UserCheck className="w-16 h-16 text-muted-foreground opacity-30 mb-4" />
            <p className="text-muted-foreground">{t("noData", lang)}</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/50">
                    <TableHead className="text-xs font-semibold">
                      {t("name", lang)}
                    </TableHead>
                    <TableHead className="text-xs font-semibold hidden sm:table-cell">
                      {t("contactPerson", lang)}
                    </TableHead>
                    <TableHead className="text-xs font-semibold hidden md:table-cell">
                      {t("phone", lang)}
                    </TableHead>
                    <TableHead className="text-xs font-semibold hidden lg:table-cell">
                      {t("address", lang)}
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-right">
                      {t("actions", lang)}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell>
                        <p className="text-sm font-semibold">{customer.name}</p>
                        <p className="text-xs text-muted-foreground sm:hidden">
                          {customer.contactPerson}
                        </p>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground hidden sm:table-cell">
                        {customer.contactPerson}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground hidden md:table-cell">
                        {customer.phone}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground hidden lg:table-cell max-w-[150px] truncate">
                        {customer.address}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(customer)}
                            className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors touch-manipulation"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(customer)}
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
          data-ocid="customer.bulk_upload.dialog"
        >
          <DialogHeader>
            <DialogTitle>{t("bulkUpload", lang)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Button
              variant="outline"
              onClick={generateCustomerTemplate}
              className="w-full gap-2"
              data-ocid="customer.bulk_upload.template.button"
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
                data-ocid="customer.bulk_upload.dropzone"
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
                data-ocid="customer.bulk_upload.loading_state"
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
                data-ocid="customer.bulk_upload.success_state"
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
              data-ocid="customer.bulk_upload.cancel_button"
            >
              {t("cancel", lang)}
            </Button>
            <Button
              onClick={handleBulkUpload}
              disabled={!uploadFile || uploading}
              data-ocid="customer.bulk_upload.submit_button"
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

      {/* Add/Edit Customer Modal */}
      <Dialog open={showModal} onOpenChange={(o) => !o && setShowModal(false)}>
        <DialogContent className="w-[95vw] max-w-md rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCustomer
                ? t("editCustomer", lang)
                : t("addCustomer", lang)}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm">{t("name", lang)}</Label>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="上海星光贸易有限公司"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{t("contactPerson", lang)}</Label>
              <Input
                value={form.contactPerson}
                onChange={(e) =>
                  setForm((f) => ({ ...f, contactPerson: e.target.value }))
                }
                placeholder="张伟"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{t("phone", lang)}</Label>
              <Input
                value={form.phone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, phone: e.target.value }))
                }
                placeholder="021-5678-9012"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{t("email", lang)}</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
                placeholder="contact@company.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{t("address", lang)}</Label>
              <Input
                value={form.address}
                onChange={(e) =>
                  setForm((f) => ({ ...f, address: e.target.value }))
                }
                placeholder="上海市浦东新区"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowModal(false)}>
              {t("cancel", lang)}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
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
    </div>
  );
}
