import { type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

/** Mobile: slides up from bottom. Desktop: becomes a right-side panel. */
export function BottomSheet({ open, onClose, children }: BottomSheetProps) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end md:items-stretch md:justify-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.2 }}
            className="relative z-10 max-h-[85vh] w-full overflow-y-auto rounded-t-sheet bg-bg p-5 shadow-soft md:h-full md:max-h-full md:w-[440px] md:rounded-none"
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-border md:hidden" />
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
