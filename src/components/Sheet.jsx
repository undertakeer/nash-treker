import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";

export default function Sheet({ open, onClose, children, tall = false }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div
            className="absolute inset-0 bg-black/65 backdrop-blur-[3px]"
            onClick={onClose}
          />
          <motion.div
            className="relative w-full max-w-[520px] rounded-t-[28px] bg-[#111116] border-t border-x border-white/8 overflow-hidden"
            style={{ height: tall ? "92vh" : "auto", maxHeight: "92vh" }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 340 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 130 || info.velocity.y > 700) onClose();
            }}
          >
            <div className="pt-3 pb-1 grid place-items-center cursor-grab active:cursor-grabbing">
              <div className="w-10 h-1 rounded-full bg-white/22" />
            </div>
            <div className="overflow-y-auto no-scrollbar" style={{ maxHeight: "calc(92vh - 20px)" }}>
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
