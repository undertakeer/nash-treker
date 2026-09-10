import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { hex } from "../lib/theme";
import { TASHKENT } from "../lib/places";

// Тёмная подложка CARTO поверх данных OpenStreetMap: бесплатно и без ключа.
// Если однажды перестанет отдаваться — меняется на одну строчку:
// https://tile.openstreetmap.org/{z}/{x}/{y}.png
const TILES = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const ATTRIBUTION = '&copy; OpenStreetMap &copy; CARTO';

function pinIcon(place, active) {
  const c = hex(place.color || "sky");
  return L.divIcon({
    className: "",
    html: `<div class="place-pin${active ? " is-active" : ""}" style="--pin:${c}">
             <span>${place.emoji || "📍"}</span>
           </div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

const MapCanvas = forwardRef(function MapCanvas(
  { places, selectedId, onSelect, onLongPress, mePos },
  ref
) {
  const host = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);
  const meMarker = useRef(null);
  // колбэки живут в ref: пересоздавать карту на каждый рендер нельзя
  const cb = useRef({ onSelect, onLongPress });
  cb.current = { onSelect, onLongPress };

  useImperativeHandle(ref, () => ({
    center: () => {
      const c = map.current?.getCenter();
      return c ? { lat: c.lat, lng: c.lng } : null;
    },
    flyTo: (lat, lng, zoom) => map.current?.flyTo([lat, lng], zoom ?? map.current.getZoom(), { duration: 0.6 }),
  }), []);

  useEffect(() => {
    if (map.current || !host.current) return;
    const m = L.map(host.current, {
      zoomControl: false,
      attributionControl: true,
      preferCanvas: true,
    }).setView([TASHKENT.lat, TASHKENT.lng], TASHKENT.zoom);
    L.tileLayer(TILES, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(m);
    // на телефоне Leaflet шлёт contextmenu по долгому нажатию
    m.on("contextmenu", (e) => cb.current.onLongPress?.({ lat: e.latlng.lat, lng: e.latlng.lng }));
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    // контейнер часто получает финальный размер уже после монтирования
    const t = setTimeout(() => m.invalidateSize(), 80);
    return () => { clearTimeout(t); m.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    const g = layer.current;
    if (!g) return;
    g.clearLayers();
    places.forEach((p) => {
      L.marker([p.lat, p.lng], { icon: pinIcon(p, p.id === selectedId), riseOnHover: true })
        .on("click", () => cb.current.onSelect?.(p))
        .addTo(g);
    });
  }, [places, selectedId]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (meMarker.current) { meMarker.current.remove(); meMarker.current = null; }
    if (!mePos) return;
    meMarker.current = L.marker([mePos.lat, mePos.lng], {
      icon: L.divIcon({ className: "", html: '<div class="me-dot"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }),
      interactive: false,
    }).addTo(m);
  }, [mePos]);

  return <div ref={host} className="map-tint absolute inset-0" />;
});

export default MapCanvas;
