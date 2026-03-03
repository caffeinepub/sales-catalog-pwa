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
  Container,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  deleteAllContainerItems,
  deleteContainerFromDb,
  getAllContainers,
  getAllExtendedProducts,
  getContainerItems,
  saveContainer,
  saveContainerItem,
} from "../lib/db";
import { useAuthStore } from "../stores/useAuthStore";
import { useLanguageStore } from "../stores/useLanguageStore";
import { t } from "../translations";
import type { ContainerItem, Container as ContainerType } from "../types";

const ITEMS_PER_PAGE = 20;

interface ContainerForm {
  containerNo: string;
  shipmentNo: string;
  shipper: string;
  eta: string;
  entryPort: string;
  status: string;
  notes: string;
}

interface ContainerItemForm {
  id: string;
  productSku: string;
  productName: string;
  qty: string;
  sellingPrice: string;
  bbd: string;
}

const emptyForm: ContainerForm = {
  containerNo: "",
  shipmentNo: "",
  shipper: "",
  eta: "",
  entryPort: "",
  status: "In Transit",
  notes: "",
};

function newItemRow(): ContainerItemForm {
  return {
    id: crypto.randomUUID(),
    productSku: "",
    productName: "",
    qty: "",
    sellingPrice: "",
    bbd: "",
  };
}

function StatusBadge({
  status,
  lang,
}: { status: string; lang: "traditional" | "english" }) {
  if (status === "In Transit") {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
        {t("inTransit", lang)}
      </span>
    );
  }
  if (status === "Arrived") {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
        {t("arrived", lang)}
      </span>
    );
  }
  if (status === "Customs Cleared") {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
        {t("customsCleared", lang)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-muted-foreground">
      {status}
    </span>
  );
}

export function ContainerManagement() {
  const navigate = useNavigate();
  const { lang } = useLanguageStore();
  const { currentUser } = useAuthStore();

  const canEdit =
    currentUser?.role === "admin" || currentUser?.canEditContainers === true;

  const [containers, setContainers] = useState<ContainerType[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const [showModal, setShowModal] = useState(false);
  const [editingContainer, setEditingContainer] =
    useState<ContainerType | null>(null);
  const [form, setForm] = useState<ContainerForm>(emptyForm);
  const [itemRows, setItemRows] = useState<ContainerItemForm[]>([newItemRow()]);
  const [saving, setSaving] = useState(false);

  // Bulk SKU upload state
  const [showBulkSku, setShowBulkSku] = useState(false);
  const [bulkSkuText, setBulkSkuText] = useState("");

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const loadContainers = async () => {
    setLoading(true);
    try {
      const cached = await getAllContainers();
      // Sort by createdAt descending (newest first)
      cached.sort((a, b) => Number(b.createdAt - a.createdAt));
      setContainers(cached);
    } catch {
      setContainers([]);
    } finally {
      setLoading(false);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: load once on mount
  useEffect(() => {
    loadContainers();
  }, []);

  const totalPages = Math.max(1, Math.ceil(containers.length / ITEMS_PER_PAGE));
  const paginated = containers.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE,
  );

  const openAdd = () => {
    setEditingContainer(null);
    setForm(emptyForm);
    setItemRows([newItemRow()]);
    setShowModal(true);
  };

  const openEdit = async (container: ContainerType) => {
    setEditingContainer(container);
    setForm({
      containerNo: container.containerNo,
      shipmentNo: container.shipmentNo ?? "",
      shipper: container.shipper,
      eta: container.eta,
      entryPort: container.entryPort,
      status: container.status,
      notes: container.notes,
    });
    // Load existing items
    try {
      const existing = await getContainerItems(container.id);
      if (existing.length > 0) {
        setItemRows(
          existing.map((item) => ({
            id: item.id,
            productSku: item.productSku,
            productName: item.productName,
            qty: String(item.qty),
            sellingPrice: String(item.sellingPrice),
            bbd: item.bbd,
          })),
        );
      } else {
        setItemRows([newItemRow()]);
      }
    } catch {
      setItemRows([newItemRow()]);
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.containerNo) return;
    setSaving(true);
    try {
      const now = BigInt(Date.now());
      const containerId = editingContainer?.id ?? crypto.randomUUID();

      const container: ContainerType = {
        id: containerId,
        containerNo: form.containerNo,
        shipmentNo: form.shipmentNo,
        shipper: form.shipper,
        eta: form.eta,
        entryPort: form.entryPort,
        status: form.status,
        notes: form.notes,
        createdAt: editingContainer?.createdAt ?? now,
        updatedAt: now,
      };

      await saveContainer(container);

      // Save items: delete old ones and write new set
      await deleteAllContainerItems(containerId);

      const validItems = itemRows.filter((row) => row.productSku.trim() !== "");
      for (const row of validItems) {
        const item: ContainerItem = {
          id: row.id,
          containerId,
          productSku: row.productSku.trim(),
          productName: row.productName.trim(),
          qty: BigInt(Math.max(0, Number.parseInt(row.qty, 10) || 0)),
          sellingPrice: Number.parseFloat(row.sellingPrice) || 0,
          bbd: row.bbd,
        };
        await saveContainerItem(item);
      }

      await loadContainers();
      setShowModal(false);
      toast.success(t("save", lang));
    } catch {
      toast.error(t("loadError", lang));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAllContainerItems(id);
      await deleteContainerFromDb(id);
      await loadContainers();
      toast.success(t("delete", lang));
    } catch {
      toast.error(t("loadError", lang));
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const addItemRow = () => {
    setItemRows((rows) => [...rows, newItemRow()]);
  };

  const removeItemRow = (id: string) => {
    setItemRows((rows) => rows.filter((r) => r.id !== id));
  };

  const updateItemRow = (
    id: string,
    field: keyof Omit<ContainerItemForm, "id">,
    value: string,
  ) => {
    setItemRows((rows) =>
      rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
    );
  };

  const handleBulkSkuConfirm = async () => {
    const skus = bulkSkuText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (skus.length === 0) return;

    const allProducts = await getAllExtendedProducts();
    const newRows: ContainerItemForm[] = [];
    let matched = 0;

    for (const sku of skus) {
      const product = allProducts.find(
        (p) => p.sku.toLowerCase() === sku.toLowerCase(),
      );
      if (product) {
        matched++;
        newRows.push({
          id: crypto.randomUUID(),
          productSku: product.sku,
          productName:
            lang === "english"
              ? product.nameEn || product.nameCnTraditional
              : product.nameCnTraditional,
          sellingPrice: String(product.price),
          qty: "",
          bbd: "",
        });
      }
    }

    setItemRows((prev) => [...prev, ...newRows]);
    setShowBulkSku(false);
    setBulkSkuText("");

    toast.success(
      lang === "english"
        ? `Successfully added ${matched} of ${skus.length} SKUs`
        : `成功加入 ${matched} / ${skus.length} 個貨號`,
    );
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-14 z-30 bg-white border-b border-border px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate("/admin")}
          data-ocid="container.back_button"
          className="p-2 rounded-lg hover:bg-secondary -ml-2 touch-manipulation"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-bold text-lg flex-1">
          {t("containersManagement", lang)}
        </h1>
        {canEdit ? (
          <Button
            size="sm"
            onClick={openAdd}
            data-ocid="container.primary_button"
            className="gap-1.5 h-9 bg-primary-600 hover:bg-primary-700 text-white"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">{t("addContainer", lang)}</span>
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground border border-border rounded-md px-2 py-1">
            {lang === "english" ? "Read Only" : "唯讀"}
          </span>
        )}
      </div>

      <div className="p-4">
        {loading ? (
          <div
            className="flex justify-center py-16"
            data-ocid="container.loading_state"
          >
            <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          </div>
        ) : containers.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-16 text-center"
            data-ocid="container.empty_state"
          >
            <Container className="w-16 h-16 text-muted-foreground opacity-30 mb-4" />
            <p className="text-muted-foreground">{t("noData", lang)}</p>
            {canEdit && (
              <Button
                size="sm"
                onClick={openAdd}
                className="mt-4 gap-1.5 bg-primary-600 hover:bg-primary-700 text-white"
              >
                <Plus className="w-4 h-4" />
                {t("addContainer", lang)}
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="bg-white rounded-xl border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/50">
                      <TableHead className="text-xs font-semibold">
                        {t("containerNo", lang)}
                      </TableHead>
                      <TableHead className="text-xs font-semibold hidden sm:table-cell">
                        {lang === "english" ? "Shipment #" : "出貨單號"}
                      </TableHead>
                      <TableHead className="text-xs font-semibold hidden sm:table-cell">
                        {t("shipper", lang)}
                      </TableHead>
                      <TableHead className="text-xs font-semibold hidden md:table-cell">
                        {t("eta", lang)}
                      </TableHead>
                      <TableHead className="text-xs font-semibold hidden lg:table-cell">
                        {t("entryPort", lang)}
                      </TableHead>
                      <TableHead className="text-xs font-semibold">
                        {t("containerStatus", lang)}
                      </TableHead>
                      <TableHead className="text-xs font-semibold text-right">
                        {t("actions", lang)}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.map((container, index) => (
                      <TableRow
                        key={container.id}
                        data-ocid={`container.item.${(page - 1) * ITEMS_PER_PAGE + index + 1}`}
                      >
                        <TableCell className="text-sm font-semibold font-mono text-foreground">
                          {container.containerNo}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground hidden sm:table-cell">
                          {container.shipmentNo || "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground hidden sm:table-cell">
                          {container.shipper || "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground hidden md:table-cell">
                          {container.eta || "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground hidden lg:table-cell">
                          {container.entryPort || "—"}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={container.status} lang={lang} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {canEdit && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => openEdit(container)}
                                  data-ocid={`container.edit_button.${(page - 1) * ITEMS_PER_PAGE + index + 1}`}
                                  className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors touch-manipulation"
                                  aria-label="Edit container"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDeleteConfirmId(container.id)
                                  }
                                  data-ocid={`container.delete_button.${(page - 1) * ITEMS_PER_PAGE + index + 1}`}
                                  className="p-1.5 rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors touch-manipulation"
                                  aria-label="Delete container"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
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
              <div className="flex items-center justify-center gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  data-ocid="container.pagination_prev"
                  className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-border text-foreground hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {lang === "english" ? "Prev" : "上一頁"}
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (p) => (
                    <button
                      type="button"
                      key={p}
                      onClick={() => setPage(p)}
                      data-ocid={`container.pagination_page.${p}`}
                      className={`w-9 h-9 rounded-lg text-sm font-semibold transition-colors ${
                        p === page
                          ? "bg-primary-600 text-white"
                          : "bg-white border border-border text-foreground hover:bg-secondary"
                      }`}
                    >
                      {p}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  data-ocid="container.pagination_next"
                  className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-border text-foreground hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {lang === "english" ? "Next" : "下一頁"}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add/Edit Container Modal */}
      <Dialog open={showModal} onOpenChange={(o) => !o && setShowModal(false)}>
        <DialogContent
          className="w-[95vw] max-w-3xl rounded-2xl max-h-[90vh] overflow-y-auto"
          data-ocid="container.dialog"
        >
          <DialogHeader>
            <DialogTitle>
              {editingContainer
                ? t("editContainer", lang)
                : t("addContainer", lang)}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Container details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">
                  {t("containerNo", lang)}{" "}
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  data-ocid="container.container_no.input"
                  value={form.containerNo}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, containerNo: e.target.value }))
                  }
                  placeholder="TCKU1234567"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">
                  {lang === "english" ? "Shipment #" : "出貨單號"}
                </Label>
                <Input
                  data-ocid="container.shipment_no.input"
                  value={form.shipmentNo}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, shipmentNo: e.target.value }))
                  }
                  placeholder="SHP-2025-001"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">{t("shipper", lang)}</Label>
                <Input
                  data-ocid="container.shipper.input"
                  value={form.shipper}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, shipper: e.target.value }))
                  }
                  placeholder="ABC Logistics Co."
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">{t("eta", lang)}</Label>
                <Input
                  data-ocid="container.eta.input"
                  type="date"
                  value={form.eta}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, eta: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">{t("entryPort", lang)}</Label>
                <Input
                  data-ocid="container.entry_port.input"
                  value={form.entryPort}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, entryPort: e.target.value }))
                  }
                  placeholder="Felixstowe"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">{t("containerStatus", lang)}</Label>
                <Select
                  value={form.status}
                  onValueChange={(val) =>
                    setForm((f) => ({ ...f, status: val }))
                  }
                >
                  <SelectTrigger
                    data-ocid="container.status.select"
                    className="w-full"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="In Transit">
                      {t("inTransit", lang)}
                    </SelectItem>
                    <SelectItem value="Arrived">
                      {t("arrived", lang)}
                    </SelectItem>
                    <SelectItem value="Customs Cleared">
                      {t("customsCleared", lang)}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">{t("notes", lang)}</Label>
              <Textarea
                data-ocid="container.notes.textarea"
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
                placeholder={
                  lang === "english" ? "Additional notes..." : "備注..."
                }
                rows={2}
                className="resize-none"
              />
            </div>

            {/* Product List section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">
                  {t("containerItems", lang)}
                </h3>
                <div className="flex gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setBulkSkuText("");
                      setShowBulkSku(true);
                    }}
                    data-ocid="container.bulk_sku.open_modal_button"
                    className="gap-1.5 h-8 text-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {lang === "english" ? "Bulk Add SKUs" : "批量加入貨號"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={addItemRow}
                    data-ocid="container.add_item.button"
                    className="gap-1.5 h-8 text-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {t("addItem", lang)}
                  </Button>
                </div>
              </div>

              <div className="border border-border rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-secondary/50">
                      <tr>
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap">
                          {t("sku", lang)}
                        </th>
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap">
                          {t("productName", lang)}
                        </th>
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap">
                          {t("quantity", lang)}
                        </th>
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap">
                          {t("sellingPrice", lang)} (£)
                        </th>
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap">
                          {t("bbd", lang)}
                        </th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {itemRows.map((row, index) => (
                        <tr
                          key={row.id}
                          data-ocid={`container.item_row.${index + 1}`}
                        >
                          <td className="px-2 py-1.5">
                            <Input
                              data-ocid={`container.item_sku.input.${index + 1}`}
                              value={row.productSku}
                              onChange={(e) =>
                                updateItemRow(
                                  row.id,
                                  "productSku",
                                  e.target.value,
                                )
                              }
                              placeholder="SKU-001"
                              className="h-8 text-xs min-w-[80px]"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <Input
                              data-ocid={`container.item_name.input.${index + 1}`}
                              value={row.productName}
                              onChange={(e) =>
                                updateItemRow(
                                  row.id,
                                  "productName",
                                  e.target.value,
                                )
                              }
                              placeholder={
                                lang === "english" ? "Product name" : "產品名稱"
                              }
                              className="h-8 text-xs min-w-[120px]"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <Input
                              data-ocid={`container.item_qty.input.${index + 1}`}
                              type="number"
                              min="0"
                              value={row.qty}
                              onChange={(e) =>
                                updateItemRow(row.id, "qty", e.target.value)
                              }
                              placeholder="0"
                              className="h-8 text-xs min-w-[60px]"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <Input
                              data-ocid={`container.item_price.input.${index + 1}`}
                              type="number"
                              min="0"
                              step="0.01"
                              value={row.sellingPrice}
                              onChange={(e) =>
                                updateItemRow(
                                  row.id,
                                  "sellingPrice",
                                  e.target.value,
                                )
                              }
                              placeholder="0.00"
                              className="h-8 text-xs min-w-[70px]"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <Input
                              data-ocid={`container.item_bbd.input.${index + 1}`}
                              type="date"
                              value={row.bbd}
                              onChange={(e) =>
                                updateItemRow(row.id, "bbd", e.target.value)
                              }
                              className="h-8 text-xs min-w-[120px]"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <button
                              type="button"
                              onClick={() => removeItemRow(row.id)}
                              data-ocid={`container.remove_item.button.${index + 1}`}
                              className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"
                              aria-label="Remove item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowModal(false)}
              data-ocid="container.cancel_button"
            >
              {t("cancel", lang)}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.containerNo}
              data-ocid="container.save_button"
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

      {/* Bulk SKU Dialog */}
      <Dialog
        open={showBulkSku}
        onOpenChange={(o) => {
          if (!o) {
            setShowBulkSku(false);
            setBulkSkuText("");
          }
        }}
      >
        <DialogContent
          className="w-[95vw] max-w-md rounded-2xl"
          data-ocid="container.bulk_sku.dialog"
        >
          <DialogHeader>
            <DialogTitle>
              {lang === "english" ? "Bulk Add SKUs" : "批量加入貨號"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              {lang === "english"
                ? "Enter one Product SKU per line. Matched products will be added to the container."
                : "每行輸入一個貨號，符合的產品將自動加入貨櫃清單。"}
            </p>
            <Textarea
              data-ocid="container.bulk_sku.textarea"
              value={bulkSkuText}
              onChange={(e) => setBulkSkuText(e.target.value)}
              placeholder={
                lang === "english"
                  ? "Enter one Product SKU per line..."
                  : "每行輸入一個貨號..."
              }
              rows={8}
              className="resize-none font-mono text-sm"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowBulkSku(false);
                setBulkSkuText("");
              }}
              data-ocid="container.bulk_sku.cancel_button"
            >
              {t("cancel", lang)}
            </Button>
            <Button
              onClick={handleBulkSkuConfirm}
              disabled={!bulkSkuText.trim()}
              data-ocid="container.bulk_sku.confirm_button"
              className="bg-primary-600 hover:bg-primary-700 text-white"
            >
              {lang === "english" ? "Confirm" : "確認"}
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
          data-ocid="container.delete.dialog"
        >
          <DialogHeader>
            <DialogTitle>{t("deleteContainer", lang)}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            {lang === "english"
              ? "Are you sure you want to delete this container? This action cannot be undone."
              : "確定要刪除此貨櫃嗎？此操作無法撤銷。"}
          </p>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmId(null)}
              data-ocid="container.delete.cancel_button"
            >
              {t("cancel", lang)}
            </Button>
            <Button
              variant="destructive"
              data-ocid="container.delete.confirm_button"
              onClick={() => {
                if (deleteConfirmId) handleDelete(deleteConfirmId);
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
