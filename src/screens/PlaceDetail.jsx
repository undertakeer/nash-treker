import Sheet from "../components/Sheet";
import Avatar from "../components/Avatar";
import { Button } from "../components/ui";
import { useStore } from "../lib/store";
import { hex, rgba } from "../lib/theme";
import { humanDateFull } from "../lib/date";
import { categoryOf, coordLabel, distanceLabel, distanceM, googleUrl, yandexUrl } from "../lib/places";

export default function PlaceDetail({ place, mePos, onClose, onEdit }) {
  const { profiles, togglePlaceVisited } = useStore();
  if (!place) return null;

  const color = place.color || "sky";
  const author = profiles.find((p) => p.id === place.created_by);
  const visited = place.status === "visited";
  const away = distanceLabel(distanceM(mePos, place));

  return (
    <Sheet open={Boolean(place)} onClose={onClose}>
      <div className="px-5 pb-10">
        {place.photo_url && (
          <img
            src={place.photo_url}
            alt=""
            className="w-full h-52 object-cover rounded-2xl mb-4"
          />
        )}

        <div className="flex items-start gap-3">
          <span
            className="w-12 h-12 rounded-2xl grid place-items-center text-[24px] shrink-0"
            style={{ background: rgba(color, 0.2), border: `1px solid ${rgba(color, 0.35)}` }}
          >
            {place.emoji || "📍"}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[19px] font-bold leading-tight">{place.title}</div>
            <div className="text-[13px] text-white/40 mt-0.5">
              {categoryOf(place.category).label}
              {away ? ` · ${away} отсюда` : ""}
            </div>
          </div>
        </div>

        {place.note && (
          <div className="mt-4 text-[14.5px] leading-relaxed text-white/75">{place.note}</div>
        )}

        <div className="mt-4 flex items-center gap-2 text-[13px] text-white/40">
          <Avatar profile={author} size={22} showMood={false} />
          <span className="truncate">
            {author?.display_name || "кто-то"} · {humanDateFull(place.created_at.slice(0, 10))}
          </span>
        </div>

        {visited && place.visited_at && (
          <div
            className="mt-3 px-3 py-2 rounded-xl text-[13px] font-semibold inline-flex items-center gap-2"
            style={{ background: rgba(color, 0.16), color: hex(color) }}
          >
            ✅ Были {humanDateFull(place.visited_at)}
          </div>
        )}

        <div className="mt-5 space-y-2.5">
          <Button
            colorKey={color}
            variant={visited ? "ghost" : "primary"}
            onClick={() => togglePlaceVisited(place)}
          >
            {visited ? "Всё-таки ещё не были" : "Мы тут были"}
          </Button>

          <div className="grid grid-cols-2 gap-2.5">
            <a
              href={yandexUrl(place)}
              target="_blank"
              rel="noreferrer"
              className="press py-3 rounded-2xl bg-white/8 text-[14px] font-bold text-center"
            >
              Яндекс
            </a>
            <a
              href={googleUrl(place)}
              target="_blank"
              rel="noreferrer"
              className="press py-3 rounded-2xl bg-white/8 text-[14px] font-bold text-center"
            >
              Google
            </a>
          </div>

          <Button variant="ghost" onClick={() => onEdit(place)}>Изменить</Button>
        </div>

        <div className="mt-4 text-center text-[11.5px] text-white/25">{coordLabel(place)}</div>
      </div>
    </Sheet>
  );
}
