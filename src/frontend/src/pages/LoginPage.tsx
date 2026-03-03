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
import { AlertCircle, Loader2, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getBackendActor } from "../lib/backendService";
import { saveCustomersToCache, saveProductsToCache } from "../lib/db";
import { SAMPLE_CUSTOMERS, SAMPLE_PRODUCTS } from "../lib/sampleData";
import {
  ADMIN_USER,
  getUserCred,
  setUserPassword,
  useAuthStore,
} from "../stores/useAuthStore";

// Read persisted users list created by UserManagement
const USERS_STORE_KEY = "sales_catalog_users_list";
interface StoredUser {
  id: string;
  email: string;
  name: string;
  role: "admin" | "sales_rep";
}
function findStoredUser(email: string): StoredUser | undefined {
  try {
    const raw = localStorage.getItem(USERS_STORE_KEY);
    if (!raw) return undefined;
    const list = JSON.parse(raw) as StoredUser[];
    return list.find((u) => u.email.toLowerCase() === email.toLowerCase());
  } catch {
    return undefined;
  }
}
import { useLanguageStore } from "../stores/useLanguageStore";
import { t } from "../translations";

export function LoginPage() {
  const { lang, toggle } = useLanguageStore();
  const { login } = useAuthStore();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Force-change password dialog state
  const [showForceChange, setShowForceChange] = useState(false);
  const [pendingUser, setPendingUser] = useState<{
    id: string;
    email: string;
    name: string;
    role: "admin" | "sales_rep";
  } | null>(null);
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdError, setPwdError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      let user:
        | {
            id: string;
            email: string;
            name: string;
            role: "admin" | "sales_rep";
          }
        | undefined;

      if (email === ADMIN_USER.email && password === ADMIN_USER.password) {
        user = {
          id: ADMIN_USER.id,
          email: ADMIN_USER.email,
          name: ADMIN_USER.name,
          role: ADMIN_USER.role,
        };
      } else if (email && password) {
        // Check per-user credentials
        const cred = getUserCred(email);
        if (cred) {
          // Credentials exist — verify password
          if (cred.password !== password) {
            setError(t("loginError", lang));
            setLoading(false);
            return;
          }
          // Look up stored user record to get correct id/name/role
          const stored = findStoredUser(email);
          // Password correct — check if mustChange
          user = {
            id: stored?.id || crypto.randomUUID(),
            email,
            name: stored?.name || email.split("@")[0] || "Sales Rep",
            role: (stored?.role as "admin" | "sales_rep") ?? "sales_rep",
          };
          if (cred.mustChange) {
            // Seed data and cache before showing force-change dialog
            try {
              const backendActor = await getBackendActor();
              await backendActor.seedData();
            } catch {
              // Idempotent
            }
            await Promise.all([
              saveProductsToCache(SAMPLE_PRODUCTS),
              saveCustomersToCache(SAMPLE_CUSTOMERS),
            ]);
            setPendingUser(user);
            setNewPwd("");
            setConfirmPwd("");
            setPwdError("");
            setShowForceChange(true);
            setLoading(false);
            return;
          }
        } else {
          // No credential entry — legacy / first-time flow, allow entry
          const stored = findStoredUser(email);
          user = {
            id: stored?.id || crypto.randomUUID(),
            email,
            name: stored?.name || email.split("@")[0] || "Sales Rep",
            role: (stored?.role as "admin" | "sales_rep") ?? "sales_rep",
          };
        }
      } else {
        setError(t("loginError", lang));
        setLoading(false);
        return;
      }

      // Seed data on login
      try {
        const backendActor = await getBackendActor();
        await backendActor.seedData();
      } catch {
        // Idempotent, ignore errors
      }

      // Populate local cache with sample data for offline fallback
      await Promise.all([
        saveProductsToCache(SAMPLE_PRODUCTS),
        saveCustomersToCache(SAMPLE_CUSTOMERS),
      ]);

      login(user);
      navigate("/catalog");
    } catch {
      setError(t("loginError", lang));
    } finally {
      setLoading(false);
    }
  };

  const handleForceChangePassword = () => {
    setPwdError("");
    if (newPwd.length < 6) {
      setPwdError(t("passwordTooShort", lang));
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdError(t("passwordMismatch", lang));
      return;
    }
    if (!pendingUser) return;
    // Save new password
    setUserPassword(pendingUser.email, newPwd, false);
    // Log them in
    login(pendingUser);
    setShowForceChange(false);
    navigate("/catalog");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-blue-50 flex flex-col items-center justify-center p-4">
      {/* Language Toggle */}
      <div className="absolute top-4 right-4">
        <button
          type="button"
          onClick={toggle}
          className="px-3 py-1.5 rounded-md text-xs font-semibold bg-white border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shadow-xs"
        >
          {lang === "traditional" ? "EN" : "繁體"}
        </button>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary-600 flex items-center justify-center mb-4 shadow-float">
            <ShoppingBag className="w-8 h-8 text-white" />
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            {t("appName", lang)}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("salesCatalogSystem", lang)}
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-card border border-border p-6">
          <h2 className="text-lg font-semibold text-foreground mb-6">
            {t("welcomeBack", lang)}
          </h2>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium">
                {t("email", lang)}
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@admin.com"
                required
                autoComplete="email"
                className="h-11 text-base"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium">
                {t("password", lang)}
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="h-11 text-base"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-primary-600 hover:bg-primary-700 text-white font-semibold text-base"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("loggingIn", lang)}
                </>
              ) : (
                t("loginButton", lang)
              )}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground text-center mt-4">
            Admin: admin@admin.com / Admin123
          </p>
        </div>
      </div>

      {/* Footer */}
      <p className="text-xs text-muted-foreground mt-8">
        © {new Date().getFullYear()}. Built with love using{" "}
        <a
          href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground"
        >
          caffeine.ai
        </a>
      </p>

      {/* Force Change Password Dialog — non-dismissible */}
      <Dialog
        open={showForceChange}
        onOpenChange={() => {
          // Intentionally block dismissal — user must set password
        }}
      >
        <DialogContent
          className="w-[95vw] max-w-sm rounded-2xl [&>button]:hidden"
          data-ocid="login.force_change.dialog"
        >
          <DialogHeader>
            <DialogTitle>{t("mustChangePasswordTitle", lang)}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-1">
            {t("setPasswordDesc", lang)}
          </p>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm">{t("newPassword", lang)}</Label>
              <Input
                data-ocid="login.new_password.input"
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
                data-ocid="login.confirm_password.input"
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
                data-ocid="login.force_change.error_state"
              >
                {pwdError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              data-ocid="login.force_change.save_button"
              onClick={handleForceChangePassword}
              disabled={!newPwd || !confirmPwd}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white"
            >
              {t("setYourPassword", lang)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
