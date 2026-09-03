import { hex, rgba } from "../lib/theme";

export default function Avatar({ profile, size = 32, dim = false, ring = false }) {
  const s = { width: size, height: size, minWidth: size };
  const accent = profile?.accent || "slate";

  if (profile?.avatar_url) {
    return (
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
    );
  }

  return (
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
}

export function AvatarStack({ profiles = [], size = 26, doneIds = [] }) {
  return (
    <div className="flex -space-x-2">
      {profiles.map((p) => (
        <div key={p.id} className="rounded-full" style={{ boxShadow: "0 0 0 2px rgba(10,10,14,.85)" }}>
          <Avatar profile={p} size={size} dim={doneIds.length > 0 && !doneIds.includes(p.id)} />
        </div>
      ))}
    </div>
  );
}
