import { motion } from "framer-motion";
import Avatar from "./Avatar";
import { hex, rgba } from "../lib/theme";
import { relativeDay, todayISO } from "../lib/date";

export default function TaskRow({ task, assignee, onToggle, onOpen }) {
  const color = task.color || "sky";
  const overdue = !task.done && task.due_date && task.due_date < todayISO();
  const time = (task.due_time || "").slice(0, 5);

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -24, height: 0, marginBottom: 0 }}
      transition={{ type: "spring", damping: 30, stiffness: 400 }}
      className="mb-2"
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => { if (e.key === "Enter") onOpen(); }}
        className="press flex items-center gap-3 px-3.5 py-3 rounded-2xl cursor-pointer"
        style={{
          background: task.done
            ? "rgba(255,255,255,.035)"
            : overdue
            ? rgba("rose", 0.1)
            : rgba(color, 0.09),
          border: `1px solid ${
            task.done ? "rgba(255,255,255,.05)" : overdue ? rgba("rose", 0.22) : rgba(color, 0.15)
          }`,
        }}
      >
        <Checkbox done={task.done} colorKey={color} onClick={(e) => { e.stopPropagation(); onToggle(); }} />

        <span
          className="shrink-0 w-8 h-8 rounded-xl grid place-items-center text-[16px]"
          style={{ background: task.done ? "rgba(255,255,255,.05)" : rgba(color, 0.16) }}
        >
          {task.emoji}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {task.priority === 1 && !task.done && (
              <span className="text-[12px] leading-none" style={{ color: hex("amber") }}>❗️</span>
            )}
            <motion.span
              animate={{ opacity: task.done ? 0.4 : 1 }}
              className="text-[15px] font-semibold truncate block"
              style={{ textDecoration: task.done ? "line-through" : "none" }}
            >
              {task.title}
            </motion.span>
          </div>
          {(task.due_date || time || task.note) && (
            <div className="text-[12.5px] flex items-center gap-1.5 mt-0.5"
                 style={{ color: overdue ? hex("rose") : "rgba(255,255,255,.38)" }}>
              {task.due_date && <span>{relativeDay(task.due_date)}</span>}
              {time && <span>· {time}</span>}
              {task.note && <span className="truncate">· {task.note}</span>}
            </div>
          )}
        </div>

        {assignee && <Avatar profile={assignee} size={24} showMood={false} dim={task.done} />}
      </div>
    </motion.div>
  );
}

function Checkbox({ done, colorKey, onClick }) {
  return (
    <button
      onClick={onClick}
      className="press shrink-0 grid place-items-center rounded-full"
      style={{
        width: 26,
        height: 26,
        background: done ? hex(colorKey) : "transparent",
        border: `2px solid ${done ? hex(colorKey) : "rgba(255,255,255,.28)"}`,
      }}
      aria-label={done ? "Снять отметку" : "Выполнить"}
    >
      <motion.svg
        width={14}
        height={14}
        viewBox="0 0 24 24"
        fill="none"
        initial={false}
        animate={{ scale: done ? 1 : 0, opacity: done ? 1 : 0 }}
        transition={{ type: "spring", damping: 14, stiffness: 500 }}
      >
        <path d="M5 12.5l4.2 4.2L19 7" stroke="#0A0A0E" strokeWidth="3"
              strokeLinecap="round" strokeLinejoin="round" />
      </motion.svg>
    </button>
  );
}
