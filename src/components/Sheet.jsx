import { AnimatePresence, motion, useDragControls } from "framer-motion";
import { useEffect } from "react";

// высота живёт в CSS (--sheet-h): нужен запасной вариант для iOS без dvh
const SHEET_H = "var(--sheet-h)";
const PANEL_BG = "#111116";

export default function Sheet({ open, onClose, children, tall = false }) {
  const dragControls = useDragControls();

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
            className="relative w-full max-w-[520px]"
            style={{ height: tall ? SHEET_H : "auto", maxHeight: SHEET_H }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 340 }}
            drag="y"
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 130 || info.velocity.y > 700) onClose();
            }}
          >
            <div
              className="h-full rounded-t-[28px] border-t border-x border-white/8 overflow-hidden"
              style={{ background: PANEL_BG }}
            >
              <div
                onPointerDown={(e) => dragControls.start(e)}
                style={{ touchAction: "none" }}
                className="pt-3 pb-2 grid place-items-center cursor-grab active:cursor-grabbing"
              >
                <div className="w-10 h-1 rounded-full bg-white/22" />
              </div>
              <div
                data-sheet
                className="overflow-y-auto overflow-x-hidden overscroll-contain no-scrollbar"
                style={{
                  maxHeight: `calc(${SHEET_H} - 20px)`,
                  paddingBottom: "env(safe-area-inset-bottom)",
                }}
              >
                {children}
              </div>
            </div>

            {/* низ экрана у iOS плавает — досыпаем фона под шторку */}
            <div aria-hidden className="bleed-under" style={{ background: PANEL_BG }} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
