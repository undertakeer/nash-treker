import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Sheet from "../components/Sheet";
import Avatar from "../components/Avatar";
import { Button, Card, Empty, Field, Row, TextInput } from "../components/ui";
import { useStore, POINTS_PER_CHECKIN, POINTS_PER_BADGE } from "../lib/store";
import { hex, rgba } from "../lib/theme";
import { humanDate } from "../lib/date";

const WISH_EMOJI = ["🎁","💆","🍿","🍕","🍰","☕️","🛍","🎬","🎮","🌹","🛁","😴","🚗","✈️","💐","🥂"];

export default function Shop({ open, onClose }) {
  const {
    uid, profiles, partner, points, wishes, purchases,
    createWish, deleteWish, buyWish, markPurchaseDone, cancelPurchase,
  } = useStore();

  const [tab, setTab] = useState("shop");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ title: "", emoji: "🎁", price: 100 });

  const myWishes = useMemo(() => wishes.filter((w) => w.owner_id === uid && w.active), [wishes, uid]);
  const theirWishes = useMemo(
    () => wishes.filter((w) => w.owner_id !== uid && w.active),
    [wishes, uid]
  );
  const pending = useMemo(() => purchases.filter((p) => p.status === "pending"), [purchases]);

  async function submit() {
    if (!draft.title.trim()) return;
    await createWish({ title: draft.title.trim(), emoji: draft.emoji, price: Number(draft.price) || 100 });
    setDraft({ title: "", emoji: "🎁", price: 100 });
    setAdding(false);
  }

  return (
    <Sheet open={open} onClose={onClose} tall>
      <div className="px-5 pb-12">
        <div className="flex items-center justify-between py-3">
          <button onClick={onClose} className="press text-[15px] text-white/50 font-medium">Закрыть</button>
          <div className="text-[15px] font-bold">Магазин желаний</div>
          <span className="w-14" />
        </div>

        <div
          className="rounded-3xl p-5 mb-5 text-center"
          style={{
            background: `linear-gradient(168deg, ${rgba("amber", 0.14)} 0%, ${rgba("amber", 0.42)} 100%), #0F0F14`,
            border: `1px solid ${rgba("amber", 0.2)}`,
          }}
        >
          <div className="text-[12px] font-bold tracking-[0.14em] uppercase text-white/45 mb-1.5">
            Ваш баланс
          </div>
          <div className="text-[40px] font-extrabold leading-none">🪙 {points.balance}</div>
          <div className="text-[12.5px] text-white/45 mt-2">
            заработано {points.earned} · потрачено {points.spent}
          </div>
          <div className="text-[11.5px] text-white/30 mt-1">
            {POINTS_PER_CHECKIN} за отметку, {POINTS_PER_BADGE} за достижение
          </div>
        </div>

        <div className="flex p-1 rounded-2xl bg-white/6 border border-white/8 mb-4">
          {[
            { v: "shop", t: "Мои желания" },
            { v: "their", t: partner?.display_name?.split(" ")[0] || "Партнёр" },
            { v: "orders", t: `Заказы${pending.length ? ` · ${pending.length}` : ""}` },
          ].map((o) => (
            <button
              key={o.v}
              onClick={() => setTab(o.v)}
              className="relative flex-1 py-2 text-[13.5px] font-semibold rounded-xl"
              style={{ color: tab === o.v ? "#fff" : "rgba(255,255,255,.45)" }}
            >
              {tab === o.v && (
                <motion.span layoutId="shoptab" className="absolute inset-0 rounded-xl bg-white/12 border border-white/10" />
              )}
              <span className="relative truncate block px-1">{o.t}</span>
            </button>
          ))}
        </div>

        {tab === "shop" && (
          <>
            <div className="text-[12.5px] text-white/35 mb-3 leading-relaxed px-1">
              Выставьте, что хотите получить, и цену в баллах. Копите отметками, покупаете себе —
              исполняет партнёр.
            </div>

            {myWishes.map((w) => (
              <WishRow
                key={w.id}
                wish={w}
                affordable={points.balance >= w.price}
                onBuy={() => buyWish(w)}
                onDelete={() => deleteWish(w.id)}
              />
            ))}

            {!myWishes.length && !adding && (
              <Empty emoji="🎁" title="Список желаний пуст" subtitle="Добавьте первое — что-нибудь приятное от партнёра." />
            )}

            <AnimatePresence>
              {adding ? (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <Card className="p-4 mt-2 space-y-4">
                    <Field label="Чего хотите">
                      <TextInput
                        value={draft.title}
                        onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                        placeholder="Например, массаж спины"
                        maxLength={50}
                      />
                    </Field>
                    <Field label="Иконка">
                      <div className="grid grid-cols-8 gap-1.5">
                        {WISH_EMOJI.map((e) => (
                          <button
                            key={e}
                            onClick={() => setDraft({ ...draft, emoji: e })}
                            className="aspect-square rounded-xl grid place-items-center text-[19px] press"
                            style={{
                              background: draft.emoji === e ? rgba("amber", 0.26) : "rgba(255,255,255,.05)",
                              border: `1px solid ${draft.emoji === e ? rgba("amber", 0.45) : "transparent"}`,
                            }}
                          >
                            {e}
                          </button>
                        ))}
                      </div>
                    </Field>
                    <Field label="Цена в баллах" hint="Ориентир: 10 баллов = одна отметка">
                      <div className="flex gap-2">
                        {[50, 100, 200, 500, 1000].map((v) => (
                          <button
                            key={v}
                            onClick={() => setDraft({ ...draft, price: v })}
                            className="flex-1 py-2.5 rounded-xl text-[13px] font-bold press"
                            style={{
                              background: Number(draft.price) === v ? hex("amber") : "rgba(255,255,255,.06)",
                              color: Number(draft.price) === v ? "#0A0A0E" : "rgba(255,255,255,.55)",
                            }}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </Field>
                    <div className="flex gap-2">
                      <Button variant="ghost" onClick={() => setAdding(false)}>Отмена</Button>
                      <Button colorKey="amber" onClick={submit} disabled={!draft.title.trim()}>Добавить</Button>
                    </div>
                  </Card>
                </motion.div>
              ) : (
                <Button variant="ghost" className="mt-3" onClick={() => setAdding(true)}>
                  + Новое желание
                </Button>
              )}
            </AnimatePresence>
          </>
        )}

        {tab === "their" && (
          <>
            <div className="text-[12.5px] text-white/35 mb-3 leading-relaxed px-1">
              Что хочет партнёр. Купить может только он сам — а исполнять будете вы.
            </div>
            {theirWishes.length ? (
              theirWishes.map((w) => (
                <div key={w.id} className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-white/5 border border-white/8 mb-2">
                  <span className="text-[22px]">{w.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[15px] font-bold truncate">{w.title}</div>
                    <div className="text-[13px] text-white/40">🪙 {w.price}</div>
                  </div>
                </div>
              ))
            ) : (
              <Empty emoji="🫙" title="Партнёр пока ничего не хочет" subtitle="Или просто не успел добавить." />
            )}
          </>
        )}

        {tab === "orders" && (
          <>
            {!purchases.length ? (
              <Empty emoji="🧾" title="Покупок ещё не было" subtitle="Копите баллы и берите первое желание." />
            ) : (
              purchases.map((p) => {
                const buyer = profiles.find((x) => x.id === p.buyer_id);
                const mine = p.buyer_id === uid;
                return (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-white/5 border border-white/8 mb-2">
                    <span className="text-[22px]">{p.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[15px] font-bold truncate">{p.title}</div>
                      <div className="text-[12.5px] text-white/40 flex items-center gap-1.5">
                        <Avatar profile={buyer} size={15} showMood={false} />
                        {mine ? "вы" : buyer?.display_name?.split(" ")[0]} · 🪙 {p.price} ·{" "}
                        {humanDate((p.created_at || "").slice(0, 10))}
                      </div>
                    </div>
                    {p.status === "pending" ? (
                      mine ? (
                        <button onClick={() => cancelPurchase(p)} className="press text-[12.5px] text-white/35 px-2">
                          отменить
                        </button>
                      ) : (
                        <button
                          onClick={() => markPurchaseDone(p)}
                          className="press px-3 py-1.5 rounded-full text-[12.5px] font-bold"
                          style={{ background: rgba("mint", 0.18), color: hex("mint") }}
                        >
                          Исполнено
                        </button>
                      )
                    ) : (
                      <span className="text-[12.5px] text-white/30">
                        {p.status === "done" ? "✅" : "отменено"}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}

function WishRow({ wish, affordable, onBuy, onDelete }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-white/5 border border-white/8 mb-2">
      <span className="text-[22px]">{wish.emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-bold truncate">{wish.title}</div>
        <div className="text-[13px] text-white/40">🪙 {wish.price}</div>
      </div>
      <button
        onClick={onDelete}
        className="press text-white/25 text-[15px] px-1"
        aria-label="Удалить желание"
      >
        ×
      </button>
      <button
        onClick={() => { if (confirm) { onBuy(); setConfirm(false); } else setConfirm(true); }}
        onBlur={() => setConfirm(false)}
        disabled={!affordable}
        className="press px-3.5 py-2 rounded-full text-[12.5px] font-bold disabled:opacity-30"
        style={{ background: rgba("amber", 0.2), color: hex("amber") }}
      >
        {confirm ? "Точно?" : "Купить"}
      </button>
    </div>
  );
}
