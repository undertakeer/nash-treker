import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import MissingTable from "../components/MissingTable";
import { CheckCircle, Empty, Progress, SegmentedControl } from "../components/ui";
import { useStore } from "../lib/store";
import { hex, rgba } from "../lib/theme";
import { humanDate, humanDateFull, todayISO } from "../lib/date";
import {
  DAY_PARTS, courseProgress, dayPartOf, dosesFor, eventKind, hhmm,
  inCourse, scheduleLabel, slotsOf, untilLabel, weekTaken,
} from "../lib/meds";

export default function Treatment({ onOpenMed, onCreateMed, onOpenEvent, onCreateEvent, onBurst }) {
  const { uid, partner, meds, medEvents, takenKeys, toggleDose, toggleMedEvent, missing } = useStore();
  const [view, setView] = useState("today");
  const [whose, setWhose] = useState("mine");
  const today = todayISO();

  const ownerId = whose === "mine" ? uid : partner?.id;
  const mine = whose === "mine";

  const myMeds = useMemo(() => meds.filter((m) => m.owner_id === ownerId), [meds, ownerId]);
  const myEvents = useMemo(
    () => medEvents.filter((e) => e.owner_id === ownerId).slice()
      .sort((a, b) => (a.done !== b.done ? (a.done ? 1 : -1) : a.date < b.date ? -1 : 1)),
    [medEvents, ownerId]
  );

  const doses = useMemo(() => dosesFor(myMeds, today), [myMeds, today]);
  const takenCount = doses.filter((d) => takenKeys.has(`${d.med.id}|${today}|${d.slot}`)).length;
  const percent = doses.length ? Math.round((takenCount / doses.length) * 100) : 0;

  const openEvents = myEvents.filter((e) => !e.done);
  const soon = openEvents.filter((e) => e.date <= today);

  const options = [{ value: "mine", label: "Моё" }];
  const partnerHas = partner && meds.some((m) => m.owner_id === partner.id);
  if (partnerHas) {
    options.push({ value: "theirs", label: partner.display_name?.split(" ")[0] || "Партнёр" });
  }

  function handleDose(d) {
    toggleDose(d.med, today, d.slot).then((on) => { if (on) onBurst?.(d.med.color); });
  }

  const create = () => (view === "events" ? onCreateEvent() : onCreateMed());

  return (
    <div className="px-4 pb-8">
      <header className="safe-top pt-2 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[12px] font-bold tracking-[0.14em] text-white/35 uppercase mb-1">
              Курс лечения
            </div>
            <h1 className="text-[29px] font-extrabold tracking-tight leading-none">Лечение</h1>
          </div>
          {mine && (
            <button
              onClick={create}
              className="press w-11 h-11 shrink-0 rounded-full bg-white/10 border border-white/10 grid place-items-center text-[22px] font-light leading-none pb-0.5"
              aria-label={view === "events" ? "Новая веха" : "Новый препарат"}
            >
              +
            </button>
          )}
        </div>
      </header>

      {missing.includes("meds") && <MissingTable what="Лечение" />}

      {options.length > 1 && (
        <div className="mb-3">
          <SegmentedControl value={whose} onChange={setWhose} options={options} />
        </div>
      )}

      <div className="mb-4">
        <SegmentedControl
          value={view}
          onChange={setView}
          options={[
            { value: "today", label: "Сегодня", badge: doses.length - takenCount },
            { value: "course", label: "Курс", badge: myMeds.filter((m) => m.status === "active").length },
            { value: "events", label: "Вехи", badge: soon.length },
          ]}
        />
      </div>

      {view === "today" && (
        <TodayView
          doses={doses}
          meds={myMeds}
          takenKeys={takenKeys}
          today={today}
          percent={percent}
          takenCount={takenCount}
          canCheck={mine}
          onToggle={handleDose}
          onOpen={onOpenMed}
          events={openEvents}
          onOpenEvent={onOpenEvent}
        />
      )}

      {view === "course" && (
        <CourseView meds={myMeds} today={today} onOpen={onOpenMed} canEdit={mine} onCreate={onCreateMed} />
      )}

      {view === "events" && (
        <EventsView
          items={myEvents}
          today={today}
          canCheck={mine}
          onToggle={toggleMedEvent}
          onOpen={onOpenEvent}
          onCreate={onCreateEvent}
        />
      )}
    </div>
  );
}

function TodayView({
  doses, meds, takenKeys, today, percent, takenCount, canCheck, onToggle, onOpen, events, onOpenEvent,
}) {
  const due = events.filter((e) => e.date <= today);

  if (!meds.length) {
    return (
      <Empty
        emoji="💊"
        title="Лечения пока нет"
        subtitle="Добавьте препарат: расписание, время приёма и сколько тянется курс. Дальше приложение будет напоминать само."
      />
    );
  }

  if (!doses.length) {
    return (
      <>
        {due.length > 0 && <DueEvents items={due} today={today} onOpen={onOpenEvent} />}
        <Empty
          emoji="🌤"
          title="На сегодня приёмов нет"
          subtitle="По расписанию сегодня ничего не нужно. Загляните во «Курс», чтобы проверить."
        />
      </>
    );
  }

  const groups = DAY_PARTS.map((part) => ({
    part,
    items: doses.filter((d) => dayPartOf(d.slot).id === part.id),
  })).filter((g) => g.items.length);

  return (
    <>
      {due.length > 0 && <DueEvents items={due} today={today} onOpen={onOpenEvent} />}

      <div className="rounded-3xl bg-white/5 border border-white/8 p-4 mb-4">
        <div className="flex items-end justify-between mb-3">
          <div>
            <div className="text-[27px] font-extrabold leading-none">
              {takenCount}
              <span className="text-white/30 text-[18px]"> / {doses.length}</span>
            </div>
            <div className="text-[13px] text-white/40 mt-1">
              {percent === 100 ? "Всё принято 🎉" : `Осталось ${doses.length - takenCount}`}
            </div>
          </div>
          <div className="text-[30px] font-extrabold" style={{ color: hex("teal") }}>{percent}%</div>
        </div>
        <Progress percent={percent} colorKey="teal" />
      </div>

      {groups.map(({ part, items }) => (
        <div key={part.id} className="mb-4">
          <div className="text-[13px] font-bold tracking-[0.08em] uppercase text-white/30 px-1 mb-2 flex items-center gap-1.5">
            <span className="text-[13px]">{part.emoji}</span>{part.label}
          </div>
          <div className="space-y-2">
            {items.map((d) => (
              <DoseRow
                key={d.key}
                dose={d}
                taken={takenKeys.has(`${d.med.id}|${today}|${d.slot}`)}
                takenKeys={takenKeys}
                today={today}
                canCheck={canCheck}
                onToggle={() => onToggle(d)}
                onOpen={() => onOpen(d.med)}
              />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

function DueEvents({ items, today, onOpen }) {
  return (
    <div className="space-y-2 mb-4">
      {items.map((e) => {
        const k = eventKind(e.kind);
        const late = e.date < today;
        return (
          <button
            key={e.id}
            onClick={() => onOpen(e)}
            className="press w-full flex items-center gap-3 p-3.5 rounded-2xl text-left"
            style={{
              background: late ? rgba("rose", 0.14) : rgba(k.color, 0.14),
              border: `1px solid ${late ? rgba("rose", 0.3) : rgba(k.color, 0.26)}`,
            }}
          >
            <span className="text-[20px] shrink-0">{e.emoji}</span>
            <span className="flex-1 min-w-0">
              <span className="block text-[15px] font-bold truncate">{e.title}</span>
              <span
                className="block text-[12.5px] truncate"
                style={{ color: late ? hex("rose") : "rgba(255,255,255,.45)" }}
              >
                {untilLabel(e.date)} · {humanDate(e.date)}
              </span>
            </span>
            <span className="text-[16px] text-white/25 shrink-0">›</span>
          </button>
        );
      })}
    </div>
  );
}

function DoseRow({ dose, taken, takenKeys, today, canCheck, onToggle, onOpen }) {
  const { med, slot } = dose;
  const color = med.color || "teal";
  const perWeek = med.schedule_type === "times_per_week";
  const done = perWeek ? weekTaken(med, takenKeys, today) : 0;
  const left = perWeek ? Math.max(0, (med.target_per_week || 7) - done) : 0;

  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => { if (e.key === "Enter") onOpen(); }}
        className="press flex items-center gap-3 px-3.5 py-3 rounded-2xl cursor-pointer"
        style={{
          background: taken ? "rgba(255,255,255,.04)" : rgba(color, 0.1),
          border: `1px solid ${taken ? "rgba(255,255,255,.06)" : rgba(color, 0.18)}`,
          opacity: taken ? 0.55 : 1,
        }}
      >
        <span className="text-[21px] leading-none shrink-0">{med.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-bold truncate">{med.title}</span>
            <span
              className="text-[12px] font-extrabold shrink-0 px-1.5 py-0.5 rounded-md"
              style={{ background: rgba(color, 0.22), color: hex(color) }}
            >
              {hhmm(slot)}
            </span>
          </div>
          <div className="text-[12.5px] text-white/40 truncate">
            {med.dose || scheduleLabel(med)}
            {perWeek ? ` · осталось ${left} на неделе` : ""}
          </div>
        </div>
        <CheckCircle done={taken} colorKey={color} size={30} disabled={!canCheck} onClick={onToggle} />
      </div>
    </motion.div>
  );
}

function CourseView({ meds, today, onOpen, canEdit, onCreate }) {
  if (!meds.length) {
    return (
      <Empty
        emoji="💊"
        title="Здесь пока пусто"
        subtitle={canEdit ? "Нажмите + вверху, чтобы добавить препарат." : "Партнёр ещё ничего не добавил."}
      />
    );
  }

  const active = meds.filter((m) => m.status === "active" && inCourse(m, today));
  const rest = meds.filter((m) => !active.includes(m));

  return (
    <div className="space-y-4">
      <Section items={active} onOpen={onOpen} today={today} />
      {rest.length > 0 && (
        <>
          <div className="text-[13px] font-bold tracking-[0.08em] uppercase text-white/25 px-1">
            Не в ходу
          </div>
          <Section items={rest} onOpen={onOpen} today={today} dim />
        </>
      )}
      {canEdit && (
        <button
          onClick={onCreate}
          className="press w-full py-3 rounded-2xl bg-white/5 border border-dashed border-white/15 text-[14px] font-semibold text-white/55"
        >
          ➕ Ещё препарат
        </button>
      )}
    </div>
  );
}

function Section({ items, onOpen, today, dim = false }) {
  return (
    <div className="space-y-2.5">
      {items.map((m) => {
        const color = m.color || "teal";
        const p = courseProgress(m, today);
        const pct = p?.total ? Math.min(100, Math.round((p.passed / p.total) * 100)) : null;
        const future = m.start_date > today;
        return (
          <button
            key={m.id}
            onClick={() => onOpen(m)}
            className="press w-full text-left rounded-[22px] p-4"
            style={{
              background: `linear-gradient(168deg, ${rgba(color, 0.12)} 0%, ${rgba(color, 0.34)} 100%), #0F0F14`,
              border: `1px solid ${rgba(color, 0.18)}`,
              opacity: dim ? 0.5 : 1,
            }}
          >
            <div className="flex items-start gap-3">
              <span className="text-[22px] leading-none shrink-0">{m.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="text-[16px] font-bold leading-snug">{m.title}</div>
                <div className="text-[12.5px] text-white/45">
                  {scheduleLabel(m)} · {slotsOf(m).join(", ")}
                </div>
                {m.dose && <div className="text-[12.5px] text-white/35 mt-0.5 truncate">{m.dose}</div>}
              </div>
              {m.status === "paused" && (
                <span className="text-[11px] font-bold px-2 py-1 rounded-lg bg-white/12 shrink-0">пауза</span>
              )}
            </div>

            {future ? (
              <div className="text-[12.5px] mt-3" style={{ color: hex(color) }}>
                начнётся {untilLabel(m.start_date)} · {humanDate(m.start_date)}
              </div>
            ) : pct !== null ? (
              <div className="mt-3">
                <Progress percent={pct} colorKey={color} />
                <div className="text-[12px] text-white/40 mt-1.5">
                  день {p.passed} из {p.total} · до {humanDate(m.end_date)}
                </div>
              </div>
            ) : (
              <div className="text-[12px] text-white/35 mt-3">
                с {humanDate(m.start_date)} · без срока
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

function EventsView({ items, today, canCheck, onToggle, onOpen, onCreate }) {
  if (!items.length) {
    return (
      <Empty
        emoji="🧪"
        title="Вех пока нет"
        subtitle="Сюда складываются анализы, повторные приёмы, закупки — всё, что нужно вспомнить через месяцы."
      />
    );
  }

  return (
    <div className="space-y-2">
      <AnimatePresence initial={false}>
        {items.map((e) => {
          const k = eventKind(e.kind);
          const late = !e.done && e.date < today;
          return (
            <motion.div
              key={e.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
            >
              <div
                role="button"
                tabIndex={0}
                onClick={() => onOpen(e)}
                onKeyDown={(ev) => { if (ev.key === "Enter") onOpen(e); }}
                className="press flex items-center gap-3 px-3.5 py-3 rounded-2xl cursor-pointer"
                style={{
                  background: e.done ? "rgba(255,255,255,.04)" : rgba(late ? "rose" : k.color, 0.1),
                  border: `1px solid ${e.done ? "rgba(255,255,255,.06)" : rgba(late ? "rose" : k.color, 0.2)}`,
                  opacity: e.done ? 0.5 : 1,
                }}
              >
                <span className="text-[20px] leading-none shrink-0">{e.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div
                    className="text-[15px] font-bold truncate"
                    style={{ textDecoration: e.done ? "line-through" : "none" }}
                  >
                    {e.title}
                  </div>
                  <div
                    className="text-[12.5px] truncate"
                    style={{ color: late ? hex("rose") : "rgba(255,255,255,.42)" }}
                  >
                    {e.done ? `сделано ${humanDate(e.done_at?.slice(0, 10) || e.date)}` : untilLabel(e.date)}
                    {" · "}{humanDateFull(e.date)}
                    {e.note ? ` · ${e.note}` : ""}
                  </div>
                </div>
                <CheckCircle
                  done={e.done}
                  colorKey={k.color}
                  size={28}
                  disabled={!canCheck}
                  onClick={() => onToggle(e)}
                />
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {canCheck && (
        <button
          onClick={onCreate}
          className="press w-full py-3 rounded-2xl bg-white/5 border border-dashed border-white/15 text-[14px] font-semibold text-white/55"
        >
          ➕ Ещё веха
        </button>
      )}
    </div>
  );
}
