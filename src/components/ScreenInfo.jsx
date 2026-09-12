import { useEffect, useState } from "react";
import { isStandalone } from "../lib/push";

/** Что именно видит браузер: по этим цифрам понятно, почему съезжают края. */
function measure() {
  const px = (v) => {
    const probe = document.createElement("div");
    probe.style.cssText = `position:fixed;top:-9999px;height:${v}`;
    document.body.appendChild(probe);
    const h = Math.round(probe.getBoundingClientRect().height);
    probe.remove();
    return h;
  };
  const inset = (side) => {
    const probe = document.createElement("div");
    probe.style.cssText = `position:fixed;top:-9999px;height:env(safe-area-inset-${side})`;
    document.body.appendChild(probe);
    const h = Math.round(probe.getBoundingClientRect().height);
    probe.remove();
    return h;
  };
  const nav = document.querySelector("nav")?.getBoundingClientRect();
  const root = document.documentElement;
  return {
    "окно": `${window.innerWidth} × ${window.innerHeight}`,
    "экран": `${window.screen.width} × ${window.screen.height}`,
    "100dvh / svh / lvh": `${px("100dvh")} / ${px("100svh")} / ${px("100lvh")}`,
    "html height 100%": `${Math.round(root.getBoundingClientRect().height)}`,
    "safe-area сверху / снизу": `${inset("top")} / ${inset("bottom")}`,
    "таб-бар: низ / зазор": nav
      ? `${Math.round(nav.bottom)} / ${Math.round(window.innerHeight - nav.bottom)}`
      : "не найден",
    "страница прокручивается": `${root.scrollHeight - root.clientHeight}px`,
    "с домашнего экрана": isStandalone() ? "да" : "нет",
    "масштаб": `${window.devicePixelRatio}`,
  };
}

export default function ScreenInfo() {
  const [rows, setRows] = useState(() => measure());

  useEffect(() => {
    const again = () => setRows(measure());
    const t = setTimeout(again, 300);
    window.addEventListener("resize", again);
    window.visualViewport?.addEventListener("resize", again);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", again);
      window.visualViewport?.removeEventListener("resize", again);
    };
  }, []);

  return (
    <div className="px-4 pb-4 pt-1 space-y-1.5">
      {Object.entries(rows).map(([k, v]) => (
        <div key={k} className="flex items-baseline justify-between gap-3 text-[12.5px]">
          <span className="text-white/40 shrink-0">{k}</span>
          <span className="font-semibold text-right tabular-nums">{v}</span>
        </div>
      ))}
      <div className="text-[11.5px] text-white/30 pt-1.5 leading-relaxed">
        Нужно только для разбора съезжающих краёв. Пришлите снимок этого блока.
      </div>
    </div>
  );
}
