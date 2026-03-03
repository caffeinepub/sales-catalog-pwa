import { ShoppingCart } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { useCartStore } from "../stores/useCartStore";

export function FloatingCartButton() {
  const navigate = useNavigate();
  const { items, total } = useCartStore();
  const count = items.reduce((s, i) => s + i.quantity, 0);
  const totalAmount = total();

  if (count === 0) return null;

  return (
    <AnimatePresence>
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => navigate("/cart")}
        className="fixed right-4 bottom-20 z-40 flex items-center gap-3 bg-primary-600 text-white rounded-2xl px-4 h-14 shadow-float touch-manipulation"
        aria-label="View cart"
      >
        <div className="relative">
          <ShoppingCart className="w-5 h-5" />
          <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {count > 99 ? "99+" : count}
          </span>
        </div>
        <div className="flex flex-col items-start">
          <span className="text-xs opacity-90">{count} 件</span>
          <span className="text-sm font-bold">£{totalAmount.toFixed(0)}</span>
        </div>
      </motion.button>
    </AnimatePresence>
  );
}
