/** Экран не заработает, пока в базе нет своей таблицы. Молча пустой список
    выглядит как поломка, поэтому говорим прямо, что сделать. */
export default function MissingTable({ what }) {
  return (
    <div className="mx-4 mb-4 rounded-2xl px-4 py-3.5 bg-amber-400/10 border border-amber-400/25">
      <div className="text-[14px] font-bold text-amber-100/90 mb-1">
        В базе нет нужной таблицы
      </div>
      <div className="text-[13px] text-amber-100/55 leading-relaxed">
        {what} не сохранится, пока не прогнан <b className="text-amber-100/80">supabase/apply.sql</b>{" "}
        в SQL Editor вашего Supabase. Один раз, всё остальное уже готово.
      </div>
    </div>
  );
}
