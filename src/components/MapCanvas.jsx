import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
// в maplibre-gl 6 нет default-экспорта, только именованные
import { Map as MlMap, Marker, setWorkerUrl } from "maplibre-gl";
// Свой воркер вместо того, что MapLibre ищет рядом со своим файлом: после
// сборки он оказывается по несуществующему адресу, воркер молча падает и
// карта остаётся пустой. Vite соберёт его отдельным файлом и даст ссылку.
import mapWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import { hex } from "../lib/theme";
import { TASHKENT } from "../lib/places";

// Векторные тайлы OpenFreeMap — бесплатно и без ключа. Палитра наша,
// собирается из тёмного стиля OpenFreeMap: scripts/build-map-style.mjs
const STYLE = new URL("map-style.json", document.baseURI).href;
setWorkerUrl(mapWorkerUrl);

const LONG_PRESS_MS = 520;
const LONG_PRESS_SLOP = 12; // px: сдвинул палец — значит не удержание, а панорама

function pinElement(place) {
  const el = document.createElement("div");
  el.className = "place-pin";
  el.style.setProperty("--pin", hex(place.color || "sky"));
  el.textContent = place.emoji || "📍";
  return el;
}

const MapCanvas = forwardRef(function MapCanvas(
  { places, selectedId, onSelect, onLongPress, mePos },
  ref
) {
  const host = useRef(null);
  const map = useRef(null);
  const ready = useRef(false);
  const markers = useRef(new Map());
  const meMarker = useRef(null);
  const [failed, setFailed] = useState(null);

  // колбэки живут в ref: пересоздавать карту на каждый рендер нельзя
  const cb = useRef({ onSelect, onLongPress });
  cb.current = { onSelect, onLongPress };

  useImperativeHandle(ref, () => ({
    center: () => {
      const c = map.current?.getCenter();
      return c ? { lat: c.lat, lng: c.lng } : null;
    },
    flyTo: (lat, lng, zoom) =>
      map.current?.flyTo({ center: [lng, lat], zoom: zoom ?? map.current.getZoom(), duration: 700 }),
  }), []);

  useEffect(() => {
    if (map.current || !host.current) return;
    let m;
    try {
      m = new MlMap({
        container: host.current,
        style: STYLE,
        center: [TASHKENT.lng, TASHKENT.lat],
        zoom: TASHKENT.zoom,
        attributionControl: { compact: true },
        // жесты как в нативных картах, только без вращения
        pitchWithRotate: false,
        dragRotate: false,
      });
    } catch (e) {
      // без WebGL карту не показать — говорим об этом вместо пустоты
      setFailed(e?.message || "не удалось запустить карту");
      return;
    }
    m.touchZoomRotate?.disableRotation();
    m.on("load", () => { ready.current = true; });
    m.on("error", (e) => console.warn("карта:", e?.error?.message || e));
    // состояние наружу: по нему браузерный тест понимает, что карта дорисована
    host.current.dataset.map = "loading";
    m.on("idle", () => { if (host.current) host.current.dataset.map = "ready"; });
    map.current = m;

    // Контейнер получает высоту уже после монтирования (flex + анимация входа),
    // а MapLibre снимает размер один раз при создании и сам его не пересчитывает.
    // Без этого канвас остаётся 400x300 и карта выглядит чёрной.
    const ro = new ResizeObserver(() => m.resize());
    ro.observe(host.current);

    // долгое нажатие: contextmenu на iOS по удержанию не приходит
    let timer = null;
    let start = null;
    const cancel = () => { clearTimeout(timer); timer = null; start = null; };
    const onDown = (e) => {
      // два пальца — это зум, а не установка точки
      if (e.touches.length !== 1) { cancel(); return; }
      const t = e.touches[0];
      start = { x: t.clientX, y: t.clientY, id: t.identifier };
      const box = host.current.getBoundingClientRect();
      const point = [t.clientX - box.left, t.clientY - box.top];
      timer = setTimeout(() => {
        const ll = m.unproject(point);
        cancel();
        cb.current.onLongPress?.({ lat: ll.lat, lng: ll.lng });
      }, LONG_PRESS_MS);
    };
    const onMove = (e) => {
      if (!start) return;
      if (e.touches.length !== 1) { cancel(); return; }
      // следим именно за тем пальцем, с которого начали
      const t = [...e.touches].find((x) => x.identifier === start.id);
      if (!t) { cancel(); return; }
      if (Math.hypot(t.clientX - start.x, t.clientY - start.y) > LONG_PRESS_SLOP) cancel();
    };
    const el = host.current;
    el.addEventListener("touchstart", onDown, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: true });
    el.addEventListener("touchend", cancel, { passive: true });
    el.addEventListener("touchcancel", cancel, { passive: true });
    el.addEventListener("gesturestart", cancel, { passive: true });
    // на компьютере — правая кнопка
    m.on("contextmenu", (e) => cb.current.onLongPress?.({ lat: e.lngLat.lat, lng: e.lngLat.lng }));

    return () => {
      ro.disconnect();
      cancel();
      el.removeEventListener("touchstart", onDown);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", cancel);
      el.removeEventListener("touchcancel", cancel);
      el.removeEventListener("gesturestart", cancel);
      m.remove();
      map.current = null;
      ready.current = false;
      markers.current.clear();
    };
  }, []);

  // метки: добавляем и убираем поштучно, чтобы не мигали при каждом рендере
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const alive = new Set(places.map((p) => p.id));

    markers.current.forEach((marker, id) => {
      if (!alive.has(id)) { marker.remove(); markers.current.delete(id); }
    });

    places.forEach((p) => {
      const existing = markers.current.get(p.id);
      if (existing) {
        existing.setLngLat([p.lng, p.lat]);
        const el = existing.getElement();
        el.textContent = p.emoji || "📍";
        el.style.setProperty("--pin", hex(p.color || "sky"));
        el.classList.toggle("is-active", p.id === selectedId);
        return;
      }
      const el = pinElement(p);
      el.classList.toggle("is-active", p.id === selectedId);
      el.addEventListener("click", (e) => { e.stopPropagation(); cb.current.onSelect?.(p); });
      const marker = new Marker({ element: el, anchor: "center" })
        .setLngLat([p.lng, p.lat])
        .addTo(m);
      markers.current.set(p.id, marker);
    });
  }, [places, selectedId]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (meMarker.current) { meMarker.current.remove(); meMarker.current = null; }
    if (!mePos) return;
    const dot = document.createElement("div");
    dot.className = "me-dot";
    meMarker.current = new Marker({ element: dot, anchor: "center" })
      .setLngLat([mePos.lng, mePos.lat])
      .addTo(m);
  }, [mePos]);

  if (failed) {
    return (
      <div className="w-full h-full grid place-items-center px-8 text-center">
        <div>
          <div className="text-[34px] mb-2">🗺</div>
          <div className="text-[14px] font-bold mb-1">Карта не открылась</div>
          <div className="text-[12.5px] text-white/40 leading-relaxed">{failed}</div>
        </div>
      </div>
    );
  }

  // Размер задаём процентами, а не inset-0: MapLibre навязывает контейнеру
  // position: relative своим css, и абсолютное позиционирование ломается.
  return <div ref={host} className="w-full h-full" />;
});

export default MapCanvas;
