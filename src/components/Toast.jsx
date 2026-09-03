import { AnimatePresence, motion } from "framer-motion";

export default function Toast({ toast }) {
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.id}
          className="fixed left-0 right-0 z-[70] flex justify-center pointer-events-none"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 92px)" }}
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.97 }}
          transition={{ type: "spring", damping: 26, stiffness: 380 }}
        >
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/12 backdrop-blur-xl border border-white/12 text-[14px] font-medium">
            {toast.emoji && <span className="text-[16px]">{toast.emoji}</span>}
            <span>{toast.text}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
