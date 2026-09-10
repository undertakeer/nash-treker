import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import TaskRow from "../components/TaskRow";
import Avatar from "../components/Avatar";
import { Empty, Progress } from "../components/ui";
import { useStore } from "../lib/store";
import { hex, rgba } from "../lib/theme";
import { addDays, todayISO } from "../lib/date";
import MissingTable from "../components/MissingTable";

export default function Tasks({ onOpenTask, onCreate, onBurst }) {
  const { tasks, profiles, uid, partner, toggleTask, createTask, clearDoneTasks, missing } = useStore();
  const today = todayISO();
  const tomorrow = addDays(today, 1);

  const [draft, setDraft] = useState("");
  const [due, setDue] = useState("today");
  const [who, setWho] = useState("both");
  const [filter, setFilter] = useState("all");
  const [showDone, setShowDone] = useState(false);

  const visible = useMemo(() => {
    if (filter === "mine") return tasks.filter((t) => t.assignee_id === uid);
    if (filter === "partner") return tasks.filter((t) => t.assignee_id === partner?.id);
    if (filter === "shared") return tasks.filter((t) => !t.assignee_id);
    return tasks;
  }, [tasks, filter, uid, partner]);

  const open = visible.filter((t) => !t.done);
  const done = visible.filter((t) => t.done);

  const groups = useMemo(() => {
    const sort = (a, b) =>
      (b.priority || 0) - (a.priority || 0) ||
      (a.due_time || "99:99").localeCompare(b.due_time || "99:99") ||
      (a.position || 0) - (b.position || 0);
    return [
      { key: "overdue", title: "Просрочено", tone: "rose",
        items: open.filter((t) => t.due_date && t.due_date < today).sort(sort) },
      { key: "today", title: "Сегодня", tone: null,
        items: open.filter((t) => t.due_date === today).sort(sort) },
      { key: "tomorrow", title: "Завтра", tone: null,
        items: open.filter((t) => t.due_date === tomorrow).sort(sort) },
      { key: "later", title: "Позже", tone: null,
        items: open.filter((t) => t.due_date && t.due_date > tomorrow).sort(sort) },
      { key: "someday", title: "Без срока", tone: null,
        items: open.filter((t) => !t.due_date).sort(sort) },
    ].filter((g) => g.items.length);
  }, [open, today, tomorrow]);

  const todayTotal = visible.filter((t) => t.due_date === today || (t.done && t.due_date === today)).length;
  const todayDone = visible.filter((t) => t.done && t.due_date === today).length;
  const percent = todayTotal ? Math.round((todayDone / todayTotal) * 100) : 0;

  const profileById = (id) => profiles.find((p) => p.id === id) || null;

  async function quickAdd() {
    const title = draft.trim();
    if (!title) return;
    setDraft("");
    await createTask({
      title,
      due_date: due === "none" ? null : due === "today" ? today : tomorrow,
      assignee_id: who === "both" ? null : who === "me" ? uid : partner?.id || null,
    });
  }

  async function handleToggle(task) {
    const nowDone = await toggleTask(task);
    if (nowDone) {
      const left = open.filter((t) => t.id !== task.id && t.due_date === today).length;
      if (left === 0 && task.due_date === today) onBurst?.(task.color || "sky");
    }
  }

  const filters = [
    { v: "all", t: "Все", n: tasks.filter((x) => !x.done).length },
    { v: "mine", t: "Мои", n: tasks.filter((x) => !x.done && x.assignee_id === uid).length },
    { v: "shared", t: "Общие", n: tasks.filter((x) => !x.done && !x.assignee_id).length },
  ];
  if (partner) {
    filters.push({
      v: "partner",
      t: partner.display_name?.split(" ")[0] || "Партнёр",
      n: tasks.filter((x) => !x.done && x.assignee_id === partner.id).length,
    });
  }

  return (
    <div className="px-4 pb-8">
      <header className="safe-top pt-2 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[12px] font-bold tracking-[0.14em] text-white/35 uppercase mb-1">
              Список дел
            </div>
            <h1 className="text-[29px] font-extrabold tracking-tight leading-none">Задачи</h1>
          </div>
          <button
            onClick={onCreate}
            className="press w-11 h-11 shrink-0 rounded-full bg-white/10 border border-white/10 grid place-items-center text-[22px] font-light leading-none pb-0.5"
            aria-label="Новая задача"
          >
            +
          </button>
        </div>
      </header>

      {missing.includes("tasks") && <MissingTable what="Задача" />}

      {todayTotal > 0 && (
        <div className="rounded-2xl bg-white/5 border border-white/8 p-3.5 mb-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[13.5px] font-semibold text-white/55">
              Сегодня {todayDone} из {todayTotal}
            </div>
            <div className="text-[13.5px] font-extrabold" style={{ color: hex("sky") }}>{percent}%</div>
          </div>
          <Progress percent={percent} colorKey="sky" />
        </div>
      )}

      {/* быстрое добавление */}
      <div className="rounded-2xl bg-white/6 border border-white/10 p-2.5 mb-3">
        <div className="flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") quickAdd(); }}
            placeholder="Что нужно сделать?"
            maxLength={80}
            className="flex-1 min-w-0 bg-transparent outline-none text-[15px] px-2 py-1.5 placeholder:text-white/25"
          />
          <button
            onClick={quickAdd}
            disabled={!draft.trim()}
            className="press w-9 h-9 shrink-0 rounded-xl grid place-items-center text-[19px] font-light leading-none pb-0.5 disabled:opacity-25"
            style={{ background: hex("sky"), color: "#0A0A0E" }}
          >
            +
          </button>
        </div>

        <AnimatePresence>
          {draft.trim() && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex gap-1.5 pt-2.5 px-1 flex-wrap">
                {[
                  { v: "today", t: "Сегодня" },
                  { v: "tomorrow", t: "Завтра" },
                  { v: "none", t: "Без срока" },
                ].map((o) => (
                  <Mini key={o.v} active={due === o.v} onClick={() => setDue(o.v)} label={o.t} />
                ))}
                <span className="w-px bg-white/10 mx-1" />
                <Mini active={who === "both"} onClick={() => setWho("both")} label="Общая" />
                <Mini active={who === "me"} onClick={() => setWho("me")} label="Мне" />
                {partner && (
                  <Mini
                    active={who === "partner"}
                    onClick={() => setWho("partner")}
                    label={partner.display_name?.split(" ")[0] || "Партнёру"}
                  />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-3 -mx-1 px-1">
        {filters.map((f) => (
          <button
            key={f.v}
            onClick={() => setFilter(f.v)}
            className="press shrink-0 px-3.5 py-2 rounded-full text-[13px] font-semibold flex items-center gap-1.5"
            style={{
              background: filter === f.v ? rgba("sky", 0.2) : "rgba(255,255,255,.05)",
              color: filter === f.v ? hex("sky") : "rgba(255,255,255,.5)",
              border: `1px solid ${filter === f.v ? rgba("sky", 0.36) : "transparent"}`,
            }}
          >
            {f.t}
            {f.n > 0 && <span className="text-[11px] font-extrabold opacity-70">{f.n}</span>}
          </button>
        ))}
      </div>

      {!open.length && !done.length ? (
        <Empty
          emoji="🗒"
          title="Задач нет"
          subtitle="Напишите что-нибудь в строке выше — попадёт в список обоим."
        />
      ) : !open.length ? (
        <div className="py-12 text-center">
          <div className="text-[42px] mb-2">🎉</div>
          <div className="text-[17px] font-bold">Всё сделано</div>
          <div className="text-[13.5px] text-white/40 mt-1">Список пуст, можно выдохнуть.</div>
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.key} className="mb-5">
            <div
              className="text-[13px] font-bold tracking-[0.08em] uppercase mb-2.5 px-1 flex items-center gap-2"
              style={{ color: g.tone ? hex(g.tone) : "rgba(255,255,255,.3)" }}
            >
              {g.title}
              <span className="opacity-60">{g.items.length}</span>
            </div>
            <AnimatePresence initial={false}>
              {g.items.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  assignee={profileById(t.assignee_id)}
                  onToggle={() => handleToggle(t)}
                  onOpen={() => onOpenTask(t)}
                />
              ))}
            </AnimatePresence>
          </section>
        ))
      )}

      {done.length > 0 && (
        <section className="mt-2">
          <div className="flex items-center justify-between mb-2.5 px-1">
            <button
              onClick={() => setShowDone((v) => !v)}
              className="press text-[13px] font-bold tracking-[0.08em] uppercase text-white/30 flex items-center gap-1.5"
            >
              Выполнено · {done.length}
              <span className="text-[11px]">{showDone ? "▲" : "▼"}</span>
            </button>
            {showDone && (
              <button onClick={clearDoneTasks} className="press text-[12.5px] text-white/35">
                Очистить
              </button>
            )}
          </div>
          <AnimatePresence initial={false}>
            {showDone &&
              done
                .slice()
                .sort((a, b) => (b.done_at || "").localeCompare(a.done_at || ""))
                .slice(0, 30)
                .map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    assignee={profileById(t.done_by || t.assignee_id)}
                    onToggle={() => handleToggle(t)}
                    onOpen={() => onOpenTask(t)}
                  />
                ))}
          </AnimatePresence>
        </section>
      )}
    </div>
  );
}

function Mini({ active, onClick, label }) {
  return (
    <button
      onClick={onClick}
      className="press px-2.5 py-1.5 rounded-lg text-[12.5px] font-semibold"
      style={{
        background: active ? rgba("sky", 0.22) : "rgba(255,255,255,.05)",
        color: active ? hex("sky") : "rgba(255,255,255,.45)",
      }}
    >
      {label}
    </button>
  );
}
