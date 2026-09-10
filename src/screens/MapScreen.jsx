import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import MapCanvas from "../components/MapCanvas";
import Avatar from "../components/Avatar";
import MissingTable from "../components/MissingTable";
import { Empty, SegmentedControl } from "../components/ui";
import { useStore } from "../lib/store";
import { hex, rgba } from "../lib/theme";
import { CATEGORIES, categoryOf, distanceLabel, distanceM, TASHKENT } from "../lib/places";

const FILTERS = [
  { id: "all", label: "Все" },
  { id: "want", label: "Хотим" },
  { id: "visited", label: "Были" },
];

export default function MapScreen({ onCreateAt, onOpenPlace }) {
  const { places, profiles, showToast, missing } = useStore();
  const [view, setView] = useState("map");
  const [filter, setFilter] = useState("all");
  const [category, setCategory] = useState(null);
  const [picking, setPicking] = useState(false);
  const [mePos, setMePos] = useState(null);
  const [selected, setSelected] = useState(null);
  const canvas = useRef(null);

  const list = useMemo(() => {
    let out = places;
    if (filter !== "all") out = out.filter((p) => p.status === filter);
    if (category) out = out.filter((p) => p.category === category);
    return out;
  }, [places, filter, category]);

  const sorted = useMemo(() => {
    if (!mePos) return list;
    return list
      .map((p) => ({ p, d: distanceM(mePos, p) }))
      .sort((a, b) => a.d - b.d)
      .map((x) => x.p);
  }, [list, mePos]);

  const counts = useMemo(
    () => ({
      all: places.length,
      want: places.filter((p) => p.status === "want").length,
      visited: places.filter((p) => p.status === "visited").length,
    }),
    [places]
  );

  function locate(fly = true) {
    if (!navigator.geolocation) {
      showToast("Геолокация недоступна", "📍");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const pos = { lat: coords.latitude, lng: coords.longitude };
        setMePos(pos);
        if (fly) canvas.current?.flyTo(pos.lat, pos.lng, 16);
      },
      () => showToast("Не получилось определить место", "📍"),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  }

  function addHere() {
    if (!navigator.geolocation) {
      showToast("Геолокация недоступна — выберите точку на карте", "📍");
      setPicking(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const pos = { lat: coords.latitude, lng: coords.longitude };
        setMePos(pos);
        canvas.current?.flyTo(pos.lat, pos.lng, 17);
        onCreateAt(pos);
      },
      () => {
        showToast("Не получилось определить место — ткните в карту", "📍");
        setPicking(true);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  }

  function confirmPick() {
    const c = canvas.current?.center() || TASHKENT;
    setPicking(false);
    onCreateAt({ lat: c.lat, lng: c.lng });
  }

  function open(place) {
    setSelected(place.id);
    onOpenPlace(place);
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      <header className="safe-top px-4 pt-2 pb-3 shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[12px] font-bold tracking-[0.14em] text-white/35 uppercase mb-1">
              Ташкент
            </div>
            <h1 className="text-[29px] font-extrabold tracking-tight leading-none">Карта</h1>
          </div>
          <button
            onClick={addHere}
            className="press w-11 h-11 shrink-0 rounded-full bg-white/10 border border-white/10 grid place-items-center text-[22px] font-light leading-none pb-0.5"
            aria-label="Новое место"
          >
            +
          </button>
        </div>
      </header>

      {missing.includes("places") && (
        <div className="shrink-0"><MissingTable what="Место на карте" /></div>
      )}

      <div className="px-4 shrink-0">
        <SegmentedControl
          value={view}
          onChange={setView}
          options={[{ value: "map", label: "Карта" }, { value: "list", label: "Список" }]}
        />
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 py-3 shrink-0">
        {FILTERS.map((f) => {
          const on = filter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className="press shrink-0 px-3 py-1.5 rounded-full text-[13px] font-semibold flex items-center gap-1.5"
              style={{
                background: on ? "rgba(255,255,255,.14)" : "rgba(255,255,255,.05)",
                border: `1px solid ${on ? "rgba(255,255,255,.2)" : "rgba(255,255,255,.07)"}`,
                color: on ? "#fff" : "rgba(255,255,255,.5)",
              }}
            >
              {f.label}
              <span className="text-[11px] opacity-60">{counts[f.id]}</span>
            </button>
          );
        })}
        <div className="w-px shrink-0 bg-white/10 my-1" />
        {CATEGORIES.map((c) => {
          const on = category === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setCategory(on ? null : c.id)}
              className="press shrink-0 px-3 py-1.5 rounded-full text-[13px] font-semibold flex items-center gap-1.5"
              style={{
                background: on ? rgba(c.color, 0.22) : "rgba(255,255,255,.05)",
                border: `1px solid ${on ? rgba(c.color, 0.45) : "rgba(255,255,255,.07)"}`,
                color: on ? "#fff" : "rgba(255,255,255,.5)",
              }}
            >
              <span>{c.emoji}</span>{c.label}
            </button>
          );
        })}
      </div>

      {view === "map" ? (
        <div className="relative isolate z-0 flex-1 min-h-0 mx-4 mb-4 rounded-[24px] overflow-hidden border border-white/8">
          <MapCanvas
            ref={canvas}
            places={list}
            selectedId={selected}
            mePos={mePos}
            onSelect={open}
            onLongPress={(pos) => onCreateAt(pos)}
          />

          {picking && (
            <>
              <div className="pointer-events-none absolute inset-0 grid place-items-center z-[1100]">
                <div className="text-[30px] -mt-6 drop-shadow-[0_4px_10px_rgba(0,0,0,.8)]">📍</div>
              </div>
              <div className="absolute left-3 right-3 bottom-3 z-[1100] flex gap-2">
                <button
                  onClick={() => setPicking(false)}
                  className="press flex-1 py-3 rounded-2xl bg-black/70 backdrop-blur text-[14px] font-bold"
                >
                  Отмена
                </button>
                <button
                  onClick={confirmPick}
                  className="press flex-[2] py-3 rounded-2xl text-[14px] font-bold"
                  style={{ background: hex("sky"), color: "#0A0A0E" }}
                >
                  Поставить сюда
                </button>
              </div>
            </>
          )}

          {!picking && (
            <div className="absolute right-3 bottom-3 z-[1100] flex flex-col gap-2">
              <button
                onClick={() => locate(true)}
                className="press w-11 h-11 rounded-full bg-black/70 backdrop-blur border border-white/12 grid place-items-center text-[17px]"
                aria-label="Где я"
              >
                ◎
              </button>
              <button
                onClick={() => setPicking(true)}
                className="press w-11 h-11 rounded-full bg-black/70 backdrop-blur border border-white/12 grid place-items-center text-[17px]"
                aria-label="Указать точку на карте"
              >
                📍
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-4 pb-8">
          {!sorted.length ? (
            <Empty
              emoji="🗺"
              title="Здесь пока пусто"
              subtitle="Откройте карту, найдите точку и нажмите + — или задержите палец на нужном месте."
            />
          ) : (
            <div className="space-y-2">
              {!mePos && (
                <button
                  onClick={() => locate(false)}
                  className="press w-full py-2.5 rounded-xl bg-white/5 border border-dashed border-white/12 text-[13px] font-semibold text-white/50"
                >
                  ◎ Показать, что ближе ко мне
                </button>
              )}
              {sorted.map((p) => {
                const author = profiles.find((x) => x.id === p.created_by);
                const away = distanceLabel(distanceM(mePos, p));
                return (
                  <motion.button
                    key={p.id}
                    layout
                    onClick={() => open(p)}
                    className="press w-full flex items-center gap-3 p-3 rounded-2xl text-left"
                    style={{
                      background: rgba(p.color || "sky", 0.1),
                      border: `1px solid ${rgba(p.color || "sky", 0.18)}`,
                    }}
                  >
                    {p.thumb_url ? (
                      <img src={p.thumb_url} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" />
                    ) : (
                      <span
                        className="w-12 h-12 rounded-xl grid place-items-center text-[21px] shrink-0"
                        style={{ background: rgba(p.color || "sky", 0.18) }}
                      >
                        {p.emoji || "📍"}
                      </span>
                    )}
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="text-[15px] font-bold truncate">{p.title}</span>
                        {p.status === "visited" && <span className="text-[12px] shrink-0">✅</span>}
                      </span>
                      <span className="block text-[12.5px] text-white/40 truncate">
                        {categoryOf(p.category).label}
                        {away ? ` · ${away}` : ""}
                        {p.note ? ` · ${p.note}` : ""}
                      </span>
                    </span>
                    <Avatar profile={author} size={24} showMood={false} />
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
