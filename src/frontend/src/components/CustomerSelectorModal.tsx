import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Building2, Phone, Search, User } from "lucide-react";
import { useEffect, useState } from "react";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { getBackendActor } from "../lib/backendService";
import { getCustomersFromCache, saveCustomersToCache } from "../lib/db";
import { SAMPLE_CUSTOMERS } from "../lib/sampleData";
import { useCartStore } from "../stores/useCartStore";
import { useLanguageStore } from "../stores/useLanguageStore";
import { t } from "../translations";
import type { Customer } from "../types";

interface CustomerSelectorModalProps {
  open: boolean;
  onClose: () => void;
}

export function CustomerSelectorModal({
  open,
  onClose,
}: CustomerSelectorModalProps) {
  const { lang } = useLanguageStore();
  const { setCustomer } = useCartStore();
  const isOnline = useOnlineStatus();
  const [search, setSearch] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);

    const load = async () => {
      try {
        if (isOnline) {
          // Try to get from backend via cache
          const cached = await getCustomersFromCache();
          if (cached.length > 0) {
            setCustomers(cached);
          } else {
            setCustomers(SAMPLE_CUSTOMERS);
            await saveCustomersToCache(SAMPLE_CUSTOMERS);
          }
        } else {
          const cached = await getCustomersFromCache();
          setCustomers(cached.length > 0 ? cached : SAMPLE_CUSTOMERS);
        }
      } catch {
        setCustomers(SAMPLE_CUSTOMERS);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [open, isOnline]);

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.contactPerson.toLowerCase().includes(search.toLowerCase()),
  );

  const handleConfirm = () => {
    if (!selected) return;
    setCustomer({
      id: selected.id,
      name: selected.name,
      contactPerson: selected.contactPerson,
      phone: selected.phone,
    });
    onClose();
  };

  // Also try to load backend customers and save to cache
  useEffect(() => {
    if (!isOnline) return;
    const tryBackend = async () => {
      try {
        // Backend doesn't have getAllCustomers, use sample data
        await saveCustomersToCache(SAMPLE_CUSTOMERS);
      } catch {
        // ignore
      }
    };
    tryBackend();
  }, [isOnline]);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        // Prevent dismissal without selection
        if (!o && !selected) return;
        if (!o) onClose();
      }}
    >
      <DialogContent
        className="w-[95vw] max-w-md rounded-2xl p-0 gap-0"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-5 pt-5 pb-0">
          <DialogTitle className="text-lg font-semibold flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary-600" />
            {t("selectCustomer", lang)}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-1">
            {t("selectCustomerDesc", lang)}
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 pt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("searchCustomer", lang)}
              className="pl-9 h-10"
              autoFocus
            />
          </div>
        </div>

        <div className="mt-3 max-h-72 overflow-y-auto px-2 pb-2">
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {t("loading", lang)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {t("noCustomersFound", lang)}
            </div>
          ) : (
            filtered.map((customer) => {
              const isSelected = selected?.id === customer.id;
              return (
                <button
                  type="button"
                  key={customer.id}
                  onClick={() => setSelected(customer)}
                  className={`w-full flex items-start gap-3 p-3 rounded-xl mb-1 transition-colors text-left touch-manipulation ${
                    isSelected
                      ? "bg-primary-50 border border-primary-200"
                      : "hover:bg-secondary border border-transparent"
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold ${
                      isSelected
                        ? "bg-primary-600 text-white"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {customer.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {customer.name}
                    </p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <User className="w-3 h-3" />
                        {customer.contactPerson}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="w-3 h-3" />
                        {customer.phone}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="px-5 pb-5 pt-2">
          <Button
            onClick={handleConfirm}
            disabled={!selected}
            className="w-full h-11 bg-primary-600 hover:bg-primary-700 text-white font-semibold"
          >
            {t("confirm", lang)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
