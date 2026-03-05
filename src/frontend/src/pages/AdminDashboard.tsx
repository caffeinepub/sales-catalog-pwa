import {
  ChevronRight,
  Container,
  Database,
  LayoutGrid,
  Loader2,
  Package,
  ShoppingCart,
  Tag,
  UserCheck,
  Users,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { getBackendActor } from "../lib/backendService";
import { type BlobStorageStats, getBlobStorageStats } from "../lib/blobUpload";
import { useLanguageStore } from "../stores/useLanguageStore";
import { t } from "../translations";

interface Stats {
  totalProducts: number;
  totalCustomers: number;
  totalOrders: number;
  totalUsers: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function AdminDashboard() {
  const { lang } = useLanguageStore();
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [storageStats, setStorageStats] = useState<BlobStorageStats | null>(
    null,
  );
  const [storageLoading, setStorageLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      setLoading(true);
      try {
        if (isOnline) {
          const backendActor = await getBackendActor();
          const data = await backendActor.getAdminStats();
          setStats({
            totalProducts: Number(data.totalProducts),
            totalCustomers: Number(data.totalCustomers),
            totalOrders: Number(data.totalOrders),
            totalUsers: Number(data.totalUsers),
          });
        } else {
          setStats({
            totalProducts: 10,
            totalCustomers: 5,
            totalOrders: 0,
            totalUsers: 1,
          });
        }
      } catch {
        setStats({
          totalProducts: 10,
          totalCustomers: 5,
          totalOrders: 0,
          totalUsers: 1,
        });
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, [isOnline]);

  useEffect(() => {
    const loadStorage = async () => {
      if (!isOnline) {
        setStorageLoading(false);
        return;
      }
      setStorageLoading(true);
      try {
        const s = await getBlobStorageStats();
        setStorageStats(s);
      } catch {
        setStorageStats(null);
      } finally {
        setStorageLoading(false);
      }
    };
    loadStorage();
  }, [isOnline]);

  const statCards = [
    {
      label: t("totalProducts", lang),
      value: stats?.totalProducts ?? 0,
      icon: Package,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: t("totalCustomers", lang),
      value: stats?.totalCustomers ?? 0,
      icon: UserCheck,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: t("totalOrders", lang),
      value: stats?.totalOrders ?? 0,
      icon: ShoppingCart,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      label: t("totalUsers", lang),
      value: stats?.totalUsers ?? 0,
      icon: Users,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
  ];

  const navCards = [
    {
      path: "/admin/products",
      label: t("productManagement", lang),
      icon: Package,
      desc: lang === "english" ? "Manage product catalog" : "管理產品目錄",
    },
    {
      path: "/admin/categories",
      label: t("categoryManagement", lang),
      icon: Tag,
      desc: lang === "english" ? "Manage product categories" : "管理產品分類",
    },
    {
      path: "/admin/users",
      label: t("userManagement", lang),
      icon: Users,
      desc: lang === "english" ? "Manage user accounts" : "管理用戶賬戶",
    },
    {
      path: "/admin/customers",
      label: t("customerManagement", lang),
      icon: UserCheck,
      desc: lang === "english" ? "Manage customer info" : "管理客戶信息",
    },
    {
      path: "/admin/containers",
      label: t("containersManagement", lang),
      icon: Container,
      desc: lang === "english" ? "Track incoming shipments" : "追蹤入境貨櫃",
    },
  ];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-14 z-30 bg-white border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <LayoutGrid className="w-5 h-5 text-primary-600" />
          <h1 className="font-bold text-lg text-foreground">
            {t("adminDashboard", lang)}
          </h1>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          {statCards.map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white rounded-xl border border-border p-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    {card.label}
                  </p>
                  {loading ? (
                    <div className="h-8 w-12 bg-secondary rounded animate-pulse" />
                  ) : (
                    <p className="text-2xl font-bold text-foreground">
                      {card.value}
                    </p>
                  )}
                </div>
                <div className={`p-2 rounded-lg ${card.bg}`}>
                  <card.icon className={`w-5 h-5 ${card.color}`} />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Storage Used Indicator */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white rounded-xl border border-border p-4"
          data-ocid="admin.storage_used.card"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-50">
                <Database className="w-4 h-4 text-indigo-600" />
              </div>
              <span className="text-sm font-semibold text-foreground">
                {lang === "english" ? "Storage Used" : "儲存空間使用"}
              </span>
            </div>
            {storageLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            ) : storageStats ? (
              <span className="text-xs text-muted-foreground font-medium tabular-nums">
                {formatBytes(storageStats.usedBytes)} /{" "}
                {formatBytes(storageStats.limitBytes)}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">
                {lang === "english" ? "Unavailable" : "無法載入"}
              </span>
            )}
          </div>
          {!storageLoading && storageStats && (
            <>
              <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    storageStats.limitBytes > 0 &&
                    storageStats.usedBytes / storageStats.limitBytes > 0.85
                      ? "bg-red-500"
                      : storageStats.limitBytes > 0 &&
                          storageStats.usedBytes / storageStats.limitBytes > 0.6
                        ? "bg-amber-500"
                        : "bg-indigo-500"
                  }`}
                  style={{
                    width:
                      storageStats.limitBytes > 0
                        ? `${Math.min(100, (storageStats.usedBytes / storageStats.limitBytes) * 100).toFixed(1)}%`
                        : "0%",
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {storageStats.limitBytes > 0
                  ? `${((storageStats.usedBytes / storageStats.limitBytes) * 100).toFixed(1)}% ${lang === "english" ? "used" : "已使用"}`
                  : lang === "english"
                    ? "Usage data unavailable"
                    : "無使用量數據"}
              </p>
            </>
          )}
        </motion.div>

        {/* Navigation Cards */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">
            {lang === "english" ? "Management" : "管理功能"}
          </h2>
          {navCards.map((card, i) => (
            <motion.button
              key={card.path}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + i * 0.05 }}
              onClick={() => navigate(card.path)}
              className="w-full bg-white rounded-xl border border-border p-4 flex items-center gap-4 hover:shadow-card-hover transition-shadow text-left touch-manipulation"
            >
              <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                <card.icon className="w-5 h-5 text-primary-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-foreground">
                  {card.label}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {card.desc}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
