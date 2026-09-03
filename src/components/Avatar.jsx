import { hex, rgba } from "../lib/theme";
import { activeMood } from "../lib/moods";

export default function Avatar({
  profile, size = 32, dim = false, ring = false, showMood = true, ringBg = "#08080B",
}) {
  const s = { width: size, height: size, minWidth: size };
  const accent = profile?.accent || "slate";
  const mood = showMood && size >= 26 ? activeMood(profile) : null;
  const badge = Math.max(14, Math.round(size * 0.38));

  const inner = profile?.avatar_url ? (
    <img
      src={profile.avatar_url}
      alt={profile.display_name || ""}
      style={{
        ...s,
        opacity: dim ? 0.38 : 1,
        boxShadow: ring ? `0 0 0 2px ${rgba(accent, 0.9)}` : "none",
      }}
      className="rounded-full object-cover bg-white/10"
    />
  ) : (
    <div
      style={{
        ...s,
        fontSize: size * 0.52,
        background: rgba(accent, 0.28),
        opacity: dim ? 0.38 : 1,
        boxShadow: ring ? `0 0 0 2px ${hex(accent)}` : "none",
      }}
      className="rounded-full grid place-items-center select-none"
    >
      {profile?.emoji || "🙂"}
    </div>
  );

  if (!mood) return inner;

  return (
    <div className="relative" style={s}>
      {inner}
      <span
        title={mood.label}
        className="absolute rounded-full grid place-items-center select-none pointer-events-none"
        style={{
          left: -1,
          bottom: -1,
          width: badge,
          height: badge,
          fontSize: badge * 0.62,
          background: "#16161C",
          boxShadow: `0 0 0 2px ${ringBg}`,
          opacity: dim ? 0.5 : 1,
        }}
      >
        {mood.emoji}
      </span>
    </div>
  );
}

export function AvatarStack({ profiles = [], size = 26, doneIds = [] }) {
  return (
    <div className="flex -space-x-2">
      {profiles.map((p) => (
        <div key={p.id} className="rounded-full" style={{ boxShadow: "0 0 0 2px rgba(10,10,14,.85)" }}>
          <Avatar
            profile={p}
            size={size}
            showMood={false}
            dim={doneIds.length > 0 && !doneIds.includes(p.id)}
          />
        </div>
      ))}
    </div>
  );
}
