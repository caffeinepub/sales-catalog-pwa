import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Switch } from "@/components/ui/switch";
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
  UserPlus,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { AppUser } from "../backend.d";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { getBackendActor } from "../lib/backendService";
import { getAppUsersFromCache, saveAppUsersToCache } from "../lib/db";
import {
  type AuthUser,
  setUserPassword,
  useAuthStore,
} from "../stores/useAuthStore";
import { useLanguageStore } from "../stores/useLanguageStore";
import { t } from "../translations";

// UI-layer record derived from AppUser for display
interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: "admin" | "sales_rep";
  totalOrders: number;
  joinDate: string;
  canEditContainers: boolean;
  passwordHash: string;
  mustChangePassword: boolean;
}

const DEFAULT_ADMIN: UserRecord = {
  id: "admin-001",
  email: "admin@admin.com",
  name: "Admin User",
  role: "admin",
  totalOrders: 0,
  joinDate: new Date().toLocaleDateString("zh-CN"),
  canEditContainers: true,
  passwordHash: "Admin123",
  mustChangePassword: false,
};

function appUserToRecord(u: AppUser): UserRecord {
  return {
    id: u.id,
    email: u.email,
    name: u.fullName,
    role: u.role === "admin" ? "admin" : "sales_rep",
    totalOrders: Number(u.totalOrders),
    joinDate: u.joinDate,
    canEditContainers: u.canEditContainers,
    passwordHash: u.passwordHash,
    mustChangePassword: u.mustChangePassword,
  };
}

function recordToAppUser(r: UserRecord): AppUser {
  return {
    id: r.id,
    email: r.email,
    fullName: r.name,
    role: r.role,
    totalOrders: BigInt(r.totalOrders),
    joinDate: r.joinDate,
    canEditContainers: r.canEditContainers,
    passwordHash: r.passwordHash,
    mustChangePassword: r.mustChangePassword,
    createdAt: BigInt(Date.now()),
  };
}

interface UserForm {
  id: string;
  email: string;
  name: string;
  role: "admin" | "sales_rep";
  canEditContainers: boolean;
}

const emptyForm: UserForm = {
  id: "",
  email: "",
  name: "",
  role: "sales_rep",
  canEditContainers: false,
};

export function UserManagement() {
  const navigate = useNavigate();
  const { lang } = useLanguageStore();
  const { currentUser } = useAuthStore();
  const isOnline = useOnlineStatus();
  const [users, setUsers] = useState<UserRecord[]>([DEFAULT_ADMIN]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Combined add/edit modal
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<UserRecord | null>(null);

  // Load users on mount: backend first, fallback to localStorage cache
  useEffect(() => {
    const loadUsers = async () => {
      setLoadingUsers(true);
      try {
        if (isOnline) {
          try {
            const actor = await getBackendActor();
            const backendUsers = await actor.getAllAppUsers();
            const records = backendUsers.map(appUserToRecord);
            // Ensure admin is always present
            const hasAdmin = records.some((u) => u.id === "admin-001");
            const finalRecords = hasAdmin
              ? records.map((u) =>
                  u.id === "admin-001" ? { ...u, canEditContainers: true } : u,
                )
              : [DEFAULT_ADMIN, ...records];
            saveAppUsersToCache(backendUsers);
            setUsers(finalRecords);
            return;
          } catch {
            // Fall through to cache
          }
        }
        // Offline: use localStorage cache
        const cached = getAppUsersFromCache();
        if (cached.length > 0) {
          const records = cached.map(appUserToRecord);
          const hasAdmin = records.some((u) => u.id === "admin-001");
          setUsers(
            hasAdmin
              ? records.map((u) =>
                  u.id === "admin-001" ? { ...u, canEditContainers: true } : u,
                )
              : [DEFAULT_ADMIN, ...records],
          );
        } else {
          setUsers([DEFAULT_ADMIN]);
        }
      } finally {
        setLoadingUsers(false);
      }
    };
    loadUsers();
  }, [isOnline]);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    if (!isOnline) {
      toast.error(
        lang === "english"
          ? "Cannot make changes while offline"
          : "離線時無法儲存更改",
      );
      setDeleteTarget(null);
      return;
    }
    try {
      const actor = await getBackendActor();
      await actor.deleteAppUser(deleteTarget.email);
      const updated = users.filter((u) => u.id !== deleteTarget.id);
      saveAppUsersToCache(updated.map(recordToAppUser));
      setUsers(updated);
      toast.success(lang === "english" ? "User deleted." : "用戶已刪除。");
    } catch {
      toast.error(t("loadError", lang));
    } finally {
      setDeleteTarget(null);
    }
  };

  const openAdd = (defaultRole: "admin" | "sales_rep" = "sales_rep") => {
    setEditingUser(null);
    setForm({ ...emptyForm, role: defaultRole });
    setShowModal(true);
  };

  const openEdit = (user: UserRecord) => {
    setEditingUser(user);
    setForm({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      canEditContainers: user.canEditContainers ?? false,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.email || !form.name) return;
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
      const actor = await getBackendActor();

      if (editingUser) {
        // Edit existing user — admin-001 always keeps canEditContainers: true
        const canEditContainers =
          editingUser.id === "admin-001" ? true : form.canEditContainers;
        const updatedUser: UserRecord = {
          ...editingUser,
          email: form.email,
          name: form.name,
          role: form.role,
          canEditContainers,
        };
        // Save to backend first
        await actor.upsertAppUser(recordToAppUser(updatedUser));
        const updated = users.map((u) =>
          u.id === editingUser.id ? updatedUser : u,
        );
        saveAppUsersToCache(updated.map(recordToAppUser));
        setUsers(updated);

        // If we just edited the currently logged-in user, refresh their session
        if (currentUser && currentUser.id === editingUser.id) {
          const updatedAuthUser: AuthUser = {
            id: updatedUser.id,
            email: updatedUser.email,
            name: updatedUser.name,
            role: updatedUser.role,
            canEditContainers: updatedUser.canEditContainers,
          };
          useAuthStore.getState().login(updatedAuthUser);
        }

        toast.success(t("save", lang));
      } else {
        // Add new user — use provided ID or generate one
        const id = form.id.trim() || crypto.randomUUID();
        const now = new Date().toLocaleDateString("zh-CN");

        const newRecord: UserRecord = {
          id,
          email: form.email,
          name: form.name,
          role: form.role,
          totalOrders: 0,
          joinDate: now,
          canEditContainers: form.canEditContainers,
          // Initial password = user ID, mustChange = true
          passwordHash: id,
          mustChangePassword: true,
        };

        // Save to backend — must succeed online
        await actor.upsertAppUser(recordToAppUser(newRecord));
        // Also set localStorage credential for offline login fallback
        setUserPassword(form.email, id, true);

        setUsers((prev) => {
          const updated = [...prev, newRecord];
          saveAppUsersToCache(updated.map(recordToAppUser));
          return updated;
        });
        toast.success(
          lang === "english"
            ? `User added. Initial password: ${id}`
            : `用戶已新增。初始密碼：${id}`,
        );
      }
      setShowModal(false);
    } catch {
      toast.error(t("loadError", lang));
    } finally {
      setSaving(false);
    }
  };

  const isAdding = !editingUser;
  const isProtectedAdmin = editingUser?.id === "admin-001";

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
          {t("userManagement", lang)}
        </h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => openAdd("sales_rep")}
            className="gap-1.5 h-9"
            data-ocid="user.invite_sales_rep.open_modal_button"
          >
            <UserPlus className="w-4 h-4" />
            <span className="hidden sm:inline">
              {t("inviteSalesRep", lang)}
            </span>
          </Button>
          <Button
            size="sm"
            onClick={() => openAdd("admin")}
            className="gap-1.5 h-9 bg-primary-600 hover:bg-primary-700 text-white"
            data-ocid="user.add_admin.open_modal_button"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">{t("addAdmin", lang)}</span>
          </Button>
        </div>
      </div>

      <div className="p-4">
        {loadingUsers ? (
          <div
            className="flex justify-center py-16"
            data-ocid="user.loading_state"
          >
            <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          </div>
        ) : users.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-16 text-center"
            data-ocid="user.empty_state"
          >
            <Users className="w-16 h-16 text-muted-foreground opacity-30 mb-4" />
            <p className="text-muted-foreground">{t("noData", lang)}</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <Table data-ocid="user.table">
                <TableHeader>
                  <TableRow className="bg-secondary/50">
                    <TableHead className="text-xs font-semibold">
                      {t("fullName", lang)}
                    </TableHead>
                    <TableHead className="text-xs font-semibold hidden sm:table-cell">
                      {t("email", lang)}
                    </TableHead>
                    <TableHead className="text-xs font-semibold hidden md:table-cell">
                      {lang === "english" ? "User ID" : "用戶 ID"}
                    </TableHead>
                    <TableHead className="text-xs font-semibold">
                      {t("role", lang)}
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-center hidden md:table-cell">
                      {t("totalOrdersUser", lang)}
                    </TableHead>
                    <TableHead className="text-xs font-semibold hidden lg:table-cell">
                      {t("joinDate", lang)}
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-right">
                      {t("actions", lang)}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user, index) => (
                    <TableRow
                      key={user.id}
                      data-ocid={`user.item.${index + 1}`}
                    >
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{user.name}</p>
                          <p className="text-xs text-muted-foreground sm:hidden">
                            {user.email}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground hidden sm:table-cell">
                        {user.email}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono hidden md:table-cell max-w-[140px]">
                        <span className="truncate block" title={user.id}>
                          {user.id}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            user.role === "admin"
                              ? "bg-purple-50 text-purple-700"
                              : "bg-blue-50 text-blue-700"
                          }`}
                        >
                          {user.role === "admin"
                            ? t("adminRole", lang)
                            : t("salesRepRole", lang)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center text-sm hidden md:table-cell">
                        {user.totalOrders}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground hidden lg:table-cell">
                        {user.joinDate}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {currentUser?.role === "admin" && (
                            <button
                              type="button"
                              onClick={() => openEdit(user)}
                              data-ocid={`user.edit_button.${index + 1}`}
                              className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors touch-manipulation"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {currentUser?.role === "admin" &&
                            user.id !== "admin-001" && (
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(user)}
                                data-ocid={`user.delete_button.${index + 1}`}
                                className="p-1.5 rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors touch-manipulation"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
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

      {/* Delete User Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent data-ocid="user.delete.dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {lang === "english" ? "Delete User" : "刪除用戶"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {lang === "english"
                ? `Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`
                : `確定要刪除「${deleteTarget?.name}」嗎？此操作無法撤銷。`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              data-ocid="user.delete.cancel_button"
              onClick={() => setDeleteTarget(null)}
            >
              {lang === "english" ? "Cancel" : "取消"}
            </AlertDialogCancel>
            <AlertDialogAction
              data-ocid="user.delete.confirm_button"
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {lang === "english" ? "Delete" : "刪除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add / Edit User Modal */}
      <Dialog open={showModal} onOpenChange={(o) => !o && setShowModal(false)}>
        <DialogContent
          className="w-[95vw] max-w-sm rounded-2xl"
          data-ocid="user.dialog"
        >
          <DialogHeader>
            <DialogTitle>
              {editingUser
                ? lang === "english"
                  ? "Edit User"
                  : "編輯用戶"
                : form.role === "sales_rep"
                  ? t("inviteSalesRep", lang)
                  : t("addAdmin", lang)}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {/* User ID — editable when adding, greyed out when editing */}
            <div className="space-y-1.5">
              <Label className="text-sm">
                {lang === "english" ? "User ID" : "用戶 ID"}
              </Label>
              <Input
                data-ocid="user.id.input"
                value={form.id}
                onChange={(e) =>
                  isAdding && !isProtectedAdmin
                    ? setForm((f) => ({ ...f, id: e.target.value }))
                    : undefined
                }
                placeholder={
                  isAdding
                    ? lang === "english"
                      ? "Leave blank to auto-generate"
                      : "留空則自動產生"
                    : undefined
                }
                disabled={!isAdding || isProtectedAdmin}
                className={
                  !isAdding || isProtectedAdmin
                    ? "bg-secondary text-muted-foreground cursor-not-allowed"
                    : ""
                }
              />
              {isAdding && (
                <p className="text-xs text-muted-foreground">
                  {lang === "english"
                    ? "This will also be the initial password."
                    : "此 ID 亦為初始登入密碼。"}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">{t("fullName", lang)}</Label>
              <Input
                data-ocid="user.name.input"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="姓名"
                disabled={isProtectedAdmin}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{t("email", lang)}</Label>
              <Input
                data-ocid="user.email.input"
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
                placeholder="user@company.com"
                disabled={isProtectedAdmin}
              />
            </div>

            {/* Role selector — only visible when adding */}
            {isAdding && (
              <div className="space-y-1.5">
                <Label className="text-sm">{t("role", lang)}</Label>
                <Select
                  value={form.role}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      role: v as "admin" | "sales_rep",
                    }))
                  }
                >
                  <SelectTrigger data-ocid="user.role.select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sales_rep">
                      {t("salesRepRole", lang)}
                    </SelectItem>
                    <SelectItem value="admin">
                      {t("adminRole", lang)}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Container Editor permission toggle */}
            <div className="flex items-center gap-3 py-1">
              <Switch
                data-ocid="user.container_editor.switch"
                checked={isProtectedAdmin ? true : form.canEditContainers}
                onCheckedChange={(checked) => {
                  if (!isProtectedAdmin) {
                    setForm((f) => ({ ...f, canEditContainers: checked }));
                  }
                }}
                disabled={isProtectedAdmin}
              />
              <Label className="text-sm cursor-pointer">
                {lang === "english" ? "Container Editor" : "貨櫃編輯權限"}
              </Label>
            </div>

            {isProtectedAdmin && (
              <p className="text-xs text-muted-foreground bg-secondary/50 rounded-lg px-3 py-2">
                {lang === "english"
                  ? "The primary admin account cannot be modified here."
                  : "主要管理員帳戶無法在此修改。"}
              </p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowModal(false)}
              data-ocid="user.cancel_button"
            >
              {t("cancel", lang)}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.email || !form.name || isProtectedAdmin}
              className="bg-primary-600 hover:bg-primary-700 text-white"
              data-ocid="user.save_button"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
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
