import { motion } from "framer-motion";
import { hex, rgba } from "../lib/theme";

export function SegmentedControl({ value, onChange, options }) {
  return (
    <div className="relative flex p-1 rounded-2xl bg-white/6 border border-white/8">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className="relative flex-1 py-2 text-[14px] font-semibold rounded-xl transition-colors"
            style={{ color: active ? "#fff" : "rgba(255,255,255,.45)" }}
          >
            {active && (
              <motion.span
                layoutId="seg"
                className="absolute inset-0 rounded-xl bg-white/12 border border-white/10"
                transition={{ type: "spring", damping: 30, stiffness: 420 }}
              />
            )}
            <span className="relative flex items-center justify-center gap-1.5">
              {o.label}
              {o.badge > 0 && (
                <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-white/14 font-bold">
                  {o.badge}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function Flame({ value, size = 13, className = "" }) {
  if (!value) return null;
  return (
    <span className={`inline-flex items-center gap-1 font-bold ${className}`} style={{ fontSize: size }}>
      <span style={{ fontSize: size + 1 }}>🔥</span>
      {value}
    </span>
  );
}

export function CheckCircle({ done, onClick, size = 34, colorKey = "mint", disabled }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); if (!disabled) onClick?.(); }}
      disabled={disabled}
      className={`press grid place-items-center rounded-full shrink-0 ${done ? "pop" : ""}`}
      style={{
        width: size,
        height: size,
        background: done ? hex(colorKey) : "rgba(255,255,255,.09)",
        border: `1.5px solid ${done ? hex(colorKey) : "rgba(255,255,255,.22)"}`,
        opacity: disabled ? 0.35 : 1,
      }}
      aria-label={done ? "Отменить отметку" : "Отметить"}
    >
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none">
        <path
          d="M5 12.5l4.2 4.2L19 7"
          stroke={done ? "#0A0A0E" : "rgba(255,255,255,.55)"}
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

// именно div, а не label: внутри часто сетки кнопок, и тап по подписи
// активировал бы первую из них (например, сбрасывал цель на «без цели»)
export function Field({ label, children, hint }) {
  return (
    <div className="block">
      <div className="text-[13px] font-semibold text-white/45 mb-2">{label}</div>
      {children}
      {hint && <div className="text-[12px] text-white/30 mt-1.5">{hint}</div>}
    </div>
  );
}

export function TextInput(props) {
  return (
    <input
      {...props}
      className={`w-full px-4 py-3.5 rounded-2xl bg-white/6 border border-white/10 outline-none
                  placeholder:text-white/25 focus:border-white/25 transition-colors ${props.className || ""}`}
    />
  );
}

export function Button({ children, variant = "primary", colorKey = "mint", full = true, className = "", ...rest }) {
  const styles = {
    primary: { background: hex(colorKey), color: "#0A0A0E" },
    ghost: { background: "rgba(255,255,255,.08)", color: "#fff" },
    danger: { background: rgba("rose", 0.16), color: hex("rose") },
  }[variant];
  return (
    <button
      {...rest}
      style={styles}
      className={`press rounded-2xl font-bold text-[15px] disabled:opacity-40 ${full ? "w-full py-3.5" : ""} ${className}`}
    >
      {children}
    </button>
  );
}

export function Row({ icon, title, subtitle, right, onClick, danger }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 text-left press"
      style={{ color: danger ? hex("rose") : undefined }}
    >
      {icon && <span className="text-[18px] w-6 text-center shrink-0">{icon}</span>}
      <span className="flex-1 min-w-0">
        <span className="block text-[15px] font-semibold truncate">{title}</span>
        {subtitle && <span className="block text-[13px] text-white/40 truncate">{subtitle}</span>}
      </span>
      {right}
    </Tag>
  );
}

export function Card({ children, className = "" }) {
  return (
    <div className={`rounded-3xl bg-white/5 border border-white/8 overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

export function Switch({ checked, onChange }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="relative w-[50px] h-[30px] rounded-full transition-colors shrink-0"
      style={{ background: checked ? hex("mint") : "rgba(255,255,255,.14)" }}
    >
      <motion.span
        className="absolute top-[3px] w-6 h-6 rounded-full bg-white"
        animate={{ left: checked ? 23 : 3 }}
        transition={{ type: "spring", damping: 28, stiffness: 520 }}
      />
    </button>
  );
}

export function Progress({ percent, colorKey = "mint" }) {
  return (
    <div className="h-2 rounded-full bg-white/8 overflow-hidden">
      <motion.div
        className="h-full rounded-full"
        style={{ background: hex(colorKey) }}
        initial={{ width: 0 }}
        animate={{ width: `${percent}%` }}
        transition={{ type: "spring", damping: 30, stiffness: 120 }}
      />
    </div>
  );
}

export function Empty({ emoji, title, subtitle, action }) {
  return (
    <div className="py-16 px-8 text-center">
      <div className="text-[44px] mb-3">{emoji}</div>
      <div className="text-[17px] font-bold mb-1.5">{title}</div>
      {subtitle && <div className="text-[14px] text-white/40 leading-relaxed">{subtitle}</div>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
