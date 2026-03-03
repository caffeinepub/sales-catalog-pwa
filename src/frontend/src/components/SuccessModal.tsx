import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2, WifiOff } from "lucide-react";
import { motion } from "motion/react";
import { useLanguageStore } from "../stores/useLanguageStore";
import { t } from "../translations";

interface SuccessModalProps {
  open: boolean;
  wasOffline: boolean;
  onContinue: () => void;
}

export function SuccessModal({
  open,
  wasOffline,
  onContinue,
}: SuccessModalProps) {
  const { lang } = useLanguageStore();

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="w-[90vw] max-w-sm rounded-2xl text-center p-6">
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", duration: 0.5, delay: 0.1 }}
              className={`w-16 h-16 rounded-full flex items-center justify-center ${
                wasOffline ? "bg-amber-50" : "bg-green-50"
              }`}
            >
              {wasOffline ? (
                <WifiOff className="w-8 h-8 text-amber-600" />
              ) : (
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              )}
            </motion.div>
          </div>
          <DialogTitle className="text-xl font-bold text-foreground">
            {wasOffline
              ? t("orderSavedOffline", lang)
              : t("orderSubmitted", lang)}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-2">
            {wasOffline
              ? t("orderSavedOfflineDesc", lang)
              : t("orderSubmittedDesc", lang)}
          </DialogDescription>
        </DialogHeader>
        <Button
          onClick={onContinue}
          className="w-full h-11 bg-primary-600 hover:bg-primary-700 text-white font-semibold mt-4"
        >
          {t("continueShopping", lang)}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
