import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ChevronDown,
  ClipboardList,
  Container,
  Grid3X3,
  KeyRound,
  Settings,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { useSessionTimeout } from "../hooks/useSessionTimeout";
import { syncPendingOrders } from "../lib/sync";
import {
  changeAdminPassword,
  changeUserPassword,
  useAuthStore,
} from "../stores/useAuthStore";
import { useLanguageStore } from "../stores/useLanguageStore";
import { t } from "../translations";

export function AppLayout() {
  const { currentUser, logout } = useAuthStore();
  const { lang, toggle } = useLanguageStore();
  const isOnline = useOnlineStatus();
  const navigate = useNavigate();
  const location = useLocation();
  const prevOnlineRef = useRef(isOnline);

  // Session timeout: log out after 30 minutes of inactivity
  useSessionTimeout();

  // Change password dialog state
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdError, setPwdError] = useState("");

  // Auto-sync when coming back online
  useEffect(() => {
    if (!prevOnlineRef.current && isOnline && currentUser) {
      syncPendingOrders(currentUser.id)
        .then(({ synced }) => {
          if (synced > 0) {
            toast.success(
              `${t("syncSuccess", lang)}: ${synced} ${lang === "english" ? "orders" : "個訂單"}`,
            );
          }
        })
        .catch(() => {
          // silent
        });
    }
    prevOnlineRef.current = isOnline;
  }, [isOnline, currentUser, lang]);

  const handleChangePassword = () => {
    setPwdError("");
    if (newPwd !== confirmPwd) {
      setPwdError(t("passwordMismatch", lang));
      return;
    }
    let result: string | null;
    if (currentUser?.role === "admin") {
      result = changeAdminPassword(oldPwd, newPwd);
    } else if (currentUser?.email) {
      result = changeUserPassword(currentUser.email, oldPwd, newPwd);
    } else {
      return;
    }
    if (result === "wrong") {
      setPwdError(t("passwordWrong", lang));
      return;
    }
    if (result === "short") {
      setPwdError(t("passwordTooShort", lang));
      return;
    }
    toast.success(t("passwordChanged", lang));
    setShowChangePassword(false);
    setOldPwd("");
    setNewPwd("");
    setConfirmPwd("");
    setPwdError("");
  };

  const openChangePassword = () => {
    setOldPwd("");
    setNewPwd("");
    setConfirmPwd("");
    setPwdError("");
    setShowChangePassword(true);
  };

  const navItems = [
    {
      path: "/catalog",
      label: t("catalog", lang),
      icon: Grid3X3,
    },
    {
      path: "/orders",
      label: t("myOrders", lang),
      icon: ClipboardList,
    },
    ...(currentUser?.role === "admin"
      ? [
          {
            path: "/admin",
            label: t("admin", lang),
            icon: Settings,
          },
          {
            path: "/admin/containers",
            label: t("containers", lang),
            icon: Container,
          },
        ]
      : []),
  ];

  const isActive = (path: string) => {
    if (path === "/admin") {
      return location.pathname.startsWith("/admin");
    }
    return (
      location.pathname === path || location.pathname.startsWith(`${path}/`)
    );
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Top Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-border shadow-xs">
        <div className="flex items-center justify-between px-4 h-14">
          {/* App Name */}
          <button
            type="button"
            onClick={() => navigate("/catalog")}
            className="font-display font-bold text-lg text-primary-600 tracking-tight"
          >
            {t("appName", lang)}
          </button>

          {/* Right Controls */}
          <div className="flex items-center gap-2">
            {/* Online/Offline Indicator */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                isOnline
                  ? "bg-green-50 text-green-700"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              {isOnline ? (
                <Wifi className="w-3 h-3" />
              ) : (
                <WifiOff className="w-3 h-3" />
              )}
              <span className="hidden sm:inline">
                {isOnline ? t("online", lang) : t("offline", lang)}
              </span>
            </div>

            {/* Language Toggle */}
            <button
              type="button"
              onClick={toggle}
              data-ocid="header.language.toggle"
              className="px-3 py-1.5 rounded-md text-xs font-semibold bg-secondary text-secondary-foreground hover:bg-accent transition-colors min-h-[36px] touch-manipulation"
              aria-label="Toggle language"
            >
              {lang === "traditional" ? "繁體" : "EN"}
            </button>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-accent transition-colors min-h-[36px] touch-manipulation"
                  data-ocid="header.user.dropdown_menu"
                >
                  <div className="w-7 h-7 rounded-full bg-primary-600 text-white text-xs font-bold flex items-center justify-center">
                    {currentUser?.name?.charAt(0) ?? "U"}
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-3 py-2 border-b border-border">
                  <p className="text-sm font-medium text-foreground truncate">
                    {currentUser?.name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {currentUser?.email}
                  </p>
                </div>
                <DropdownMenuItem
                  onClick={openChangePassword}
                  data-ocid="header.change_password.button"
                  className="cursor-pointer gap-2"
                >
                  <KeyRound className="w-4 h-4" />
                  {t("changePassword", lang)}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    logout();
                    navigate("/login");
                  }}
                  data-ocid="header.logout.button"
                  className="text-destructive focus:text-destructive cursor-pointer"
                >
                  {t("logout", lang)}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 pt-14 pb-16">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border shadow-bottom-nav pb-safe">
        <div className="flex items-center justify-around h-14">
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <button
                type="button"
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center justify-center gap-0.5 px-4 py-2 min-w-[60px] min-h-[56px] transition-colors touch-manipulation ${
                  active
                    ? "text-primary-600"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <item.icon
                  className={`w-5 h-5 ${active ? "text-primary-600" : ""}`}
                  strokeWidth={active ? 2.5 : 2}
                />
                <span className="text-[10px] font-medium leading-tight">
                  {item.label}
                </span>
                {active && (
                  <div className="absolute bottom-0 w-10 h-0.5 bg-primary-600 rounded-t-full" />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Change Password Dialog */}
      <Dialog
        open={showChangePassword}
        onOpenChange={(o) => {
          if (!o) {
            setShowChangePassword(false);
            setPwdError("");
          }
        }}
      >
        <DialogContent
          className="w-[95vw] max-w-sm rounded-2xl"
          data-ocid="header.change_password.dialog"
        >
          <DialogHeader>
            <DialogTitle>{t("changePassword", lang)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm">{t("oldPassword", lang)}</Label>
              <Input
                data-ocid="header.old_password.input"
                type="password"
                value={oldPwd}
                onChange={(e) => setOldPwd(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{t("newPassword", lang)}</Label>
              <Input
                data-ocid="header.new_password.input"
                type="password"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{t("confirmPassword", lang)}</Label>
              <Input
                data-ocid="header.confirm_password.input"
                type="password"
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>
            {pwdError && (
              <p
                className="text-sm text-red-600"
                data-ocid="header.change_password.error_state"
              >
                {pwdError}
              </p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              data-ocid="header.change_password.cancel_button"
              onClick={() => {
                setShowChangePassword(false);
                setPwdError("");
              }}
            >
              {t("cancel", lang)}
            </Button>
            <Button
              data-ocid="header.change_password.save_button"
              onClick={handleChangePassword}
              disabled={!oldPwd || !newPwd || !confirmPwd}
              className="bg-primary-600 hover:bg-primary-700 text-white"
            >
              {t("save", lang)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
