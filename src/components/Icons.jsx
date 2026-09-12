// Однотонные контурные иконки: эмодзи в таб-баре смотрелись чужеродно
// рядом с остальной графикой.
const base = {
  width: 21,
  height: 21,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export function IconHabits(p) {
  return (
    <svg {...base} {...p}>
      <circle cx="12" cy="12" r="8.2" />
      <circle cx="12" cy="12" r="3.4" />
    </svg>
  );
}

export function IconToday(p) {
  return (
    <svg {...base} {...p}>
      <path d="M4.5 12.6l4.6 4.6L19.5 6.8" />
    </svg>
  );
}

export function IconTasks(p) {
  return (
    <svg {...base} {...p}>
      <rect x="4" y="4" width="16" height="16" rx="4.5" />
      <path d="M8.4 12.2l2.6 2.6 4.6-5" />
    </svg>
  );
}

export function IconMeds(p) {
  return (
    <svg {...base} {...p}>
      {/* капсула под углом; перехват идёт поперёк её длинной оси */}
      <rect x="3.2" y="8.6" width="17.6" height="6.8" rx="3.4"
            transform="rotate(-42 12 12)" />
      <path d="M9.6 9.6l4.8 4.8" />
    </svg>
  );
}

export function IconMoney(p) {
  return (
    <svg {...base} {...p}>
      {/* кошелёк: корпус, линия клапана и застёжка справа */}
      <rect x="2.9" y="6.3" width="18.2" height="11.4" rx="3.2" />
      <path d="M2.9 10.1h18.2" />
      <circle cx="17.2" cy="14" r="1.25" />
    </svg>
  );
}

export function IconMap(p) {
  return (
    <svg {...base} {...p}>
      <path d="M12 21s6.4-5.5 6.4-10.1A6.4 6.4 0 0 0 5.6 10.9C5.6 15.5 12 21 12 21z" />
      <circle cx="12" cy="10.7" r="2.4" />
    </svg>
  );
}

export function IconUs(p) {
  return (
    <svg {...base} {...p}>
      <path d="M12 20.3s-7.3-4.6-7.3-9.6a4.2 4.2 0 0 1 7.3-2.8 4.2 4.2 0 0 1 7.3 2.8c0 5-7.3 9.6-7.3 9.6z" />
    </svg>
  );
}

export function IconProfile(p) {
  return (
    <svg {...base} {...p}>
      <circle cx="12" cy="8.4" r="3.7" />
      <path d="M5.2 19.6a6.9 6.9 0 0 1 13.6 0" />
    </svg>
  );
}
