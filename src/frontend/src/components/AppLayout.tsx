import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronDown,
  ClipboardList,
  Grid3X3,
  Settings,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { syncPendingOrders } from "../lib/sync";
import { useAuthStore } from "../stores/useAuthStore";
import { useLanguageStore } from "../stores/useLanguageStore";
import { t } from "../translations";

export function AppLayout() {
  const { currentUser, logout } = useAuthStore();
  const { lang, toggle } = useLanguageStore();
  const isOnline = useOnlineStatus();
  const navigate = useNavigate();
  const location = useLocation();
  const prevOnlineRef = useRef(isOnline);

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
                  onClick={() => {
                    logout();
                    navigate("/login");
                  }}
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
    </div>
  );
}
