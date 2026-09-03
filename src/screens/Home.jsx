import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import HabitCard from "../components/HabitCard";
import { Empty, SegmentedControl } from "../components/ui";
import { useStore } from "../lib/store";
import { todayISO } from "../lib/date";

export default function Home({ onOpenHabit, onCreate, onBurst }) {
  const { habits, profiles, me, partner, uid, doneSetFor, toggleCheckin, loading } = useStore();
  const [tab, setTab] = useState("shared");

  const active = useMemo(() => habits.filter((h) => h.status === "active"), [habits]);

  const lists = useMemo(
    () => ({
      shared: active.filter((h) => h.kind === "shared"),
      mine: active.filter((h) => h.kind === "personal" && h.owner_id === uid),
      partner: active.filter((h) => h.kind === "personal" && h.owner_id && h.owner_id !== uid),
    }),
    [active, uid]
  );

  const list = lists[tab] || [];
  const featured = list.filter((h) => h.pinned);
  const rest = list.filter((h) => !h.pinned);
  const shown = featured.length ? { big: featured, small: rest } : { big: list.slice(0, 1), small: list.slice(1) };

  const options = [
    { value: "shared", label: "Общие", badge: lists.shared.length },
    { value: "mine", label: "Мои", badge: lists.mine.length },
  ];
  if (partner) {
    options.push({
      value: "partner",
      label: partner.display_name?.split(" ")[0] || "Партнёр",
      badge: lists.partner.length,
    });
  }

  const participantsOf = (h) =>
    h.kind === "shared"
      ? profiles.length
        ? profiles
        : [me].filter(Boolean)
      : profiles.filter((p) => p.id === h.owner_id);

  const setsOf = (h) => {
    const out = {};
    participantsOf(h).forEach((p) => { out[p.id] = doneSetFor(h.id, p.id); });
    return out;
  };

  function handleToggle(h) {
    const wasDone = doneSetFor(h.id, uid).has(todayISO());
    toggleCheckin(h);
    if (!wasDone) onBurst?.(h.color);
  }

  return (
    <div className="px-4 pb-32">
      <header className="safe-top pt-2 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[12px] font-bold tracking-[0.14em] text-white/35 uppercase mb-1">
              Наш трекер
            </div>
            <h1 className="text-[29px] font-extrabold tracking-tight leading-none">
              {tab === "shared" ? "Наши привычки" : tab === "mine" ? "Мои привычки" : `Привычки ${partner?.display_name || ""}`}
            </h1>
          </div>
          <button
            onClick={onCreate}
            className="press w-11 h-11 shrink-0 rounded-full bg-white/10 border border-white/10 grid place-items-center text-[22px] font-light leading-none pb-0.5"
            aria-label="Новая привычка"
          >
            +
          </button>
        </div>
      </header>

      <div className="mb-4">
        <SegmentedControl value={tab} onChange={setTab} options={options} />
      </div>

      {loading && !habits.length ? (
        <div className="space-y-3">
          <div className="skeleton h-[150px] rounded-[26px]" />
          <div className="grid grid-cols-2 gap-3">
            <div className="skeleton h-[132px] rounded-[26px]" />
            <div className="skeleton h-[132px] rounded-[26px]" />
          </div>
        </div>
      ) : !list.length ? (
        <Empty
          emoji={tab === "partner" ? "🫶" : "✨"}
          title={
            tab === "shared" ? "Общих привычек пока нет"
            : tab === "mine" ? "Личных привычек пока нет"
            : "Здесь пока пусто"
          }
          subtitle={
            tab === "partner"
              ? "Личные привычки партнёра появятся здесь — их видно, но отмечать может только он сам."
              : "Нажмите + вверху, чтобы добавить первую."
          }
        />
      ) : (
        <div className="space-y-3">
            {shown.big.map((h) => (
              <motion.div key={h.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}>
                <HabitCard
                  habit={h}
                  featured
                  participants={participantsOf(h)}
                  doneSets={setsOf(h)}
                  myId={uid}
                  canCheck={h.kind === "shared" || h.owner_id === uid}
                  onOpen={() => onOpenHabit(h.id)}
                  onToggle={() => handleToggle(h)}
                />
              </motion.div>
            ))}

            {shown.small.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {shown.small.map((h) => (
                  <motion.div key={h.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}>
                    <HabitCard
                      habit={h}
                      participants={participantsOf(h)}
                      doneSets={setsOf(h)}
                      myId={uid}
                      canCheck={h.kind === "shared" || h.owner_id === uid}
                      onOpen={() => onOpenHabit(h.id)}
                      onToggle={() => handleToggle(h)}
                    />
                  </motion.div>
                ))}
              </div>
            )}
        </div>
      )}
    </div>
  );
}
