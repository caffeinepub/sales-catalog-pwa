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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Plus, UserPlus, Users } from "lucide-react";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { getBackendActor } from "../lib/backendService";
import { setUserPassword, useAuthStore } from "../stores/useAuthStore";
import { useLanguageStore } from "../stores/useLanguageStore";
import { t } from "../translations";

interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: "admin" | "sales_rep";
  totalOrders: number;
  joinDate: string;
}

const USERS_STORE_KEY = "sales_catalog_users_list";

const DEFAULT_ADMIN: UserRecord = {
  id: "admin-001",
  email: "admin@admin.com",
  name: "Admin User",
  role: "admin",
  totalOrders: 0,
  joinDate: new Date().toLocaleDateString("zh-CN"),
};

function loadUsers(): UserRecord[] {
  try {
    const raw = localStorage.getItem(USERS_STORE_KEY);
    if (!raw) return [DEFAULT_ADMIN];
    const parsed = JSON.parse(raw) as UserRecord[];
    // Ensure admin is always present
    const hasAdmin = parsed.some((u) => u.id === "admin-001");
    return hasAdmin ? parsed : [DEFAULT_ADMIN, ...parsed];
  } catch {
    return [DEFAULT_ADMIN];
  }
}

function persistUsers(users: UserRecord[]): void {
  localStorage.setItem(USERS_STORE_KEY, JSON.stringify(users));
}

export function UserManagement() {
  const navigate = useNavigate();
  const { lang } = useLanguageStore();
  const { currentUser } = useAuthStore();
  const isOnline = useOnlineStatus();
  const [users, setUsers] = useState<UserRecord[]>(loadUsers);
  const [showInvite, setShowInvite] = useState(false);
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminName, setAdminName] = useState("");
  const [saving, setSaving] = useState(false);

  const handleInvite = async () => {
    if (!inviteEmail || !inviteName) return;
    setSaving(true);
    try {
      const id = crypto.randomUUID();
      // Attempt backend sync, but don't block local creation on failure
      if (isOnline) {
        try {
          const backendActor = await getBackendActor();
          await backendActor.inviteUser(
            id,
            inviteEmail,
            inviteName,
            currentUser?.id || null,
          );
        } catch {
          // Backend sync failed -- continue with local creation
        }
      }
      // Set initial password = user ID, mustChange = true
      setUserPassword(inviteEmail, id, true);
      const newUser: UserRecord = {
        id,
        email: inviteEmail,
        name: inviteName,
        role: "sales_rep",
        totalOrders: 0,
        joinDate: new Date().toLocaleDateString("zh-CN"),
      };
      setUsers((prev) => {
        const updated = [...prev, newUser];
        persistUsers(updated);
        return updated;
      });
      setShowInvite(false);
      setInviteEmail("");
      setInviteName("");
      toast.success(t("save", lang));
    } catch {
      toast.error(t("loadError", lang));
    } finally {
      setSaving(false);
    }
  };

  const handleAddAdmin = async () => {
    if (!adminEmail || !adminName) return;
    setSaving(true);
    try {
      const id = crypto.randomUUID();
      // Attempt backend sync, but don't block local creation on failure
      if (isOnline) {
        try {
          const backendActor = await getBackendActor();
          await backendActor.createAdminUser(id, adminEmail, adminName);
        } catch {
          // Backend sync failed -- continue with local creation
        }
      }
      // Set initial password = user ID, mustChange = true
      setUserPassword(adminEmail, id, true);
      const newAdmin: UserRecord = {
        id,
        email: adminEmail,
        name: adminName,
        role: "admin",
        totalOrders: 0,
        joinDate: new Date().toLocaleDateString("zh-CN"),
      };
      setUsers((prev) => {
        const updated = [...prev, newAdmin];
        persistUsers(updated);
        return updated;
      });
      setShowAddAdmin(false);
      setAdminEmail("");
      setAdminName("");
      toast.success(t("save", lang));
    } catch {
      toast.error(t("loadError", lang));
    } finally {
      setSaving(false);
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
          {t("userManagement", lang)}
        </h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowInvite(true)}
            className="gap-1.5 h-9"
          >
            <UserPlus className="w-4 h-4" />
            <span className="hidden sm:inline">
              {t("inviteSalesRep", lang)}
            </span>
          </Button>
          <Button
            size="sm"
            onClick={() => setShowAddAdmin(true)}
            className="gap-1.5 h-9 bg-primary-600 hover:bg-primary-700 text-white"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">{t("addAdmin", lang)}</span>
          </Button>
        </div>
      </div>

      <div className="p-4">
        {users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="w-16 h-16 text-muted-foreground opacity-30 mb-4" />
            <p className="text-muted-foreground">{t("noData", lang)}</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/50">
                    <TableHead className="text-xs font-semibold">
                      {t("fullName", lang)}
                    </TableHead>
                    <TableHead className="text-xs font-semibold hidden sm:table-cell">
                      {t("email", lang)}
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>

      {/* Invite Sales Rep Modal */}
      <Dialog
        open={showInvite}
        onOpenChange={(o) => !o && setShowInvite(false)}
      >
        <DialogContent className="w-[95vw] max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>{t("inviteSalesRep", lang)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm">{t("fullName", lang)}</Label>
              <Input
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="姓名"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{t("email", lang)}</Label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="sales@company.com"
              />
            </div>
            <p className="text-xs text-muted-foreground bg-secondary/50 rounded-lg px-3 py-2">
              {lang === "english"
                ? "Initial password: User ID (shown after saving)"
                : "初始密碼：用戶 ID（保存後顯示）"}
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowInvite(false)}>
              {t("cancel", lang)}
            </Button>
            <Button
              onClick={handleInvite}
              disabled={saving || !inviteEmail || !inviteName}
              className="bg-primary-600 hover:bg-primary-700 text-white"
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

      {/* Add Admin Modal */}
      <Dialog
        open={showAddAdmin}
        onOpenChange={(o) => !o && setShowAddAdmin(false)}
      >
        <DialogContent className="w-[95vw] max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>{t("addAdmin", lang)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm">{t("fullName", lang)}</Label>
              <Input
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                placeholder="姓名"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{t("email", lang)}</Label>
              <Input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="admin@company.com"
              />
            </div>
            <p className="text-xs text-muted-foreground bg-secondary/50 rounded-lg px-3 py-2">
              {lang === "english"
                ? "Initial password: User ID (shown after saving)"
                : "初始密碼：用戶 ID（保存後顯示）"}
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAddAdmin(false)}>
              {t("cancel", lang)}
            </Button>
            <Button
              onClick={handleAddAdmin}
              disabled={saving || !adminEmail || !adminName}
              className="bg-primary-600 hover:bg-primary-700 text-white"
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
