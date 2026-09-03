import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { isIOS, isStandalone } from "../lib/push";
import { readCache, writeCache } from "../lib/cache";

export default function InstallHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (readCache("install-hint-dismissed", false)) return;
    const t = setTimeout(() => setShow(true), 2500);
    return () => clearTimeout(t);
  }, []);

  function dismiss() {
    writeCache("install-hint-dismissed", true);
    setShow(false);
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed left-4 right-4 z-40"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 86px)" }}
        >
          <div className="max-w-[492px] mx-auto rounded-2xl bg-[#1A1A21] border border-white/12 px-4 py-3.5 flex gap-3 items-start shadow-2xl">
            <span className="text-[20px]">📲</span>
            <div className="flex-1 text-[13px] leading-relaxed text-white/70">
              {isIOS()
                ? <>Поставьте на домашний экран: <b className="text-white">«Поделиться»</b> → <b className="text-white">«На экран Домой»</b>. Только так работают уведомления.</>
                : <>Установите приложение через меню браузера, чтобы работали уведомления и офлайн-режим.</>}
            </div>
            <button onClick={dismiss} className="press text-white/35 text-[18px] leading-none -mt-0.5">×</button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
