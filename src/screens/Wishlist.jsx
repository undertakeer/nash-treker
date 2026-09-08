import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Sheet from "../components/Sheet";
import EmojiPicker from "../components/EmojiPicker";
import { Button, Empty, Field, SegmentedControl, TextInput } from "../components/ui";
import { useStore } from "../lib/store";
import { COLORS, COLOR_KEYS, hex, rgba } from "../lib/theme";
import { CURRENCIES, formatPrice, hostOf, normalizeUrl, totalByCurrency } from "../lib/money";
import { humanDateFull } from "../lib/date";

const EMOJI = [
  "🎁","👟","👕","👜","💍","⌚️","🎧","📱","💻","🖥","📷","🎮","🚲","🛹","🏂","⛺️",
  "📚","🎨","🪴","🕯","🧴","💄","🧦","🧢","🕶","🍳","☕️","🎸","🎫","✈️",
];

const EMPTY = {
  title: "", emoji: "🎁", color: "violet", note: "",
  price: "", currency: "сум", url: "", priority: 0, status: "want",
};

export default function Wishlist({ open, onClose }) {
  const { uid, partner, wishlist } = useStore();
  const [whose, setWhose] = useState("mine");
  const [editor, setEditor] = useState(null); // { item } | { item: null }

  useEffect(() => {
    if (open) setWhose("mine");
  }, [open]);

  const ownerId = whose === "mine" ? uid : partner?.id;
  const items = useMemo(
    () =>
      wishlist
        .filter((w) => w.owner_id === ownerId)
        .slice()
        .sort((a, b) => {
          if ((a.status === "got") !== (b.status === "got")) return a.status === "got" ? 1 : -1;
          if (a.priority !== b.priority) return b.priority - a.priority;
          return (a.position || 0) - (b.position || 0);
        }),
    [wishlist, ownerId]
  );

  const open_ = items.filter((w) => w.status !== "got");
  const totals = totalByCurrency(open_);

  const options = [{ value: "mine", label: "Мои", badge: wishlist.filter((w) => w.owner_id === uid && w.status !== "got").length }];
  if (partner) {
    options.push({
      value: "theirs",
      label: partner.display_name?.split(" ")[0] || "Партнёр",
      badge: wishlist.filter((w) => w.owner_id === partner.id && w.status !== "got").length,
    });
  }

  return (
    <>
      <Sheet open={open} onClose={onClose} tall>
        <div className="px-5 pb-12">
          <div className="flex items-center justify-between py-3">
            <button onClick={onClose} className="press text-[15px] text-white/50 font-medium">Закрыть</button>
            <div className="text-[15px] font-bold">Вишлист</div>
            <button
              onClick={() => { setWhose("mine"); setEditor({ item: null }); }}
              className="press text-[15px] font-bold"
              style={{ color: hex("violet") }}
            >
              Добавить
            </button>
          </div>

          {options.length > 1 && (
            <div className="mb-4">
              <SegmentedControl value={whose} onChange={setWhose} options={options} />
            </div>
          )}

          {open_.length > 0 && (
            <div className="text-[13px] text-white/40 mb-4 text-center">
              {open_.length} {open_.length === 1 ? "хотелка" : open_.length < 5 ? "хотелки" : "хотелок"}
              {totals.length ? ` · ${totals.join(" + ")}` : ""}
            </div>
          )}

          {!items.length ? (
            <Empty
              emoji="🎁"
              title={whose === "mine" ? "Ваш вишлист пуст" : "Здесь пока пусто"}
              subtitle={
                whose === "mine"
                  ? "Складывайте сюда то, что хочется. Партнёр видит список — и знает, что дарить."
                  : "Партнёр ещё ничего не добавил."
              }
            />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <AnimatePresence initial={false}>
                {items.map((w) => (
                  <WishCard key={w.id} item={w} onOpen={() => setEditor({ item: w })} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </Sheet>

      <WishEditor
        open={Boolean(editor)}
        item={editor?.item || null}
        ownerId={editor?.item ? editor.item.owner_id : uid}
        onClose={() => setEditor(null)}
      />
    </>
  );
}

function WishCard({ item, onOpen }) {
  const color = item.color || "violet";
  const got = item.status === "got";
  const price = formatPrice(item.price, item.currency);

  return (
    <motion.button
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      onClick={onOpen}
      className="press relative rounded-[22px] overflow-hidden text-left aspect-[3/4]"
      style={{
        background: `linear-gradient(168deg, ${rgba(color, 0.18)} 0%, ${rgba(color, 0.5)} 100%), #0F0F14`,
        border: `1px solid ${rgba(color, 0.2)}`,
        opacity: got ? 0.55 : 1,
      }}
    >
      {item.thumb_url || item.photo_url ? (
        <img
          src={item.thumb_url || item.photo_url}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: got ? "grayscale(1)" : "none" }}
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center text-[44px] opacity-90">
          {item.emoji}
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

      {price && (
        <span className="absolute top-2 left-2 px-2 py-1 rounded-lg bg-black/60 backdrop-blur text-[11.5px] font-extrabold">
          {price}
        </span>
      )}
      {item.priority === 1 && !got && (
        <span className="absolute top-2 right-2 text-[13px]">❗️</span>
      )}
      {got && (
        <span className="absolute top-2 right-2 px-2 py-1 rounded-lg bg-black/60 text-[11px] font-bold">
          ✅ подарено
        </span>
      )}

      <div className="absolute inset-x-0 bottom-0 p-3">
        <div className="text-[14px] font-bold leading-snug line-clamp-2">{item.title}</div>
        {item.url && (
          <div className="text-[11.5px] text-white/45 truncate mt-0.5">{hostOf(item.url)}</div>
        )}
      </div>
    </motion.button>
  );
}

function WishEditor({ open, item, ownerId, onClose }) {
  const { uid, createWishItem, updateWishItem, toggleWishItemGot, deleteWishItem } = useStore();
  const [form, setForm] = useState(EMPTY);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileInput = useRef(null);
  const editing = Boolean(item);

  useEffect(() => {
    if (!open) return;
    setForm(item ? { ...EMPTY, ...item, price: item.price ?? "", url: item.url || "" } : EMPTY);
    setFile(null);
    setPreview(null);
    setConfirmDelete(false);
    setBusy(false);
  }, [open, item]);

  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const color = form.color || "violet";
  const mine = (item?.owner_id || ownerId) === uid;

  function pickFile(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function save() {
    if (!form.title.trim() || busy) return;
    setBusy(true);
    const payload = {
      title: form.title.trim(),
      emoji: form.emoji,
      color: form.color,
      note: form.note?.trim() || null,
      price: form.price === "" ? null : Number(form.price),
      currency: form.currency,
      url: normalizeUrl(form.url),
      priority: form.priority ? 1 : 0,
    };
    try {
      if (editing) await updateWishItem(item.id, payload, file);
      else await createWishItem({ ...payload, owner_id: ownerId || uid }, file);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    await deleteWishItem(item.id);
    onClose();
  }

  const shot = preview || item?.photo_url;

  return (
    <Sheet open={open} onClose={onClose} tall>
      <div className="px-5 pb-12">
        <div className="flex items-center justify-between py-3">
          <button onClick={onClose} className="press text-[15px] text-white/50 font-medium">Отмена</button>
          <div className="text-[15px] font-bold">{editing ? "Хотелка" : "Новая хотелка"}</div>
          <button
            onClick={save}
            disabled={busy || !form.title.trim()}
            className="press text-[15px] font-bold disabled:opacity-30"
            style={{ color: hex(color) }}
          >
            {editing ? "Сохранить" : "Создать"}
          </button>
        </div>

        <div className="space-y-6">
          <Field label="Фото товара">
            <input ref={fileInput} type="file" accept="image/*" onChange={pickFile} className="hidden" />
            {shot ? (
              <div className="relative rounded-2xl overflow-hidden">
                <img src={shot} alt="" className="w-full h-52 object-cover" />
                <button
                  onClick={() => fileInput.current?.click()}
                  className="press absolute bottom-2 right-2 px-3 py-1.5 rounded-xl bg-black/65 text-[12.5px] font-semibold"
                >
                  Заменить
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInput.current?.click()}
                className="press w-full py-7 rounded-2xl bg-white/5 border border-dashed border-white/15 text-[13.5px] font-semibold text-white/55"
              >
                📷 Добавить фото
              </button>
            )}
          </Field>

          <Field label="Что хочется">
            <TextInput
              value={form.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="Например, кроссовки New Balance 530"
              maxLength={100}
            />
          </Field>

          <Field label="Цена" hint="Необязательно — просто чтобы понимать порядок.">
            <div className="flex gap-2">
              <TextInput
                type="number"
                inputMode="numeric"
                min={0}
                value={form.price}
                onChange={(e) => set({ price: e.target.value })}
                placeholder="1 200 000"
                className="flex-1"
              />
              <div className="flex gap-1 shrink-0">
                {CURRENCIES.map((c) => (
                  <button
                    key={c}
                    onClick={() => set({ currency: c })}
                    className="press w-11 rounded-xl text-[13px] font-bold"
                    style={{
                      background: form.currency === c ? hex(color) : "rgba(255,255,255,.06)",
                      color: form.currency === c ? "#0A0A0E" : "rgba(255,255,255,.55)",
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </Field>

          <Field label="Ссылка" hint="Куда идти покупать.">
            <TextInput
              value={form.url}
              onChange={(e) => set({ url: e.target.value })}
              placeholder="asaxiy.uz/product/..."
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
            />
          </Field>

          <Field label="Описание" hint="Размер, цвет, что именно — чтобы не купили не то.">
            <TextInput
              value={form.note || ""}
              onChange={(e) => set({ note: e.target.value })}
              placeholder="Необязательно"
              maxLength={200}
            />
          </Field>

          <Field label="Иконка" hint="Показывается, если нет фото.">
            <EmojiPicker
              value={form.emoji}
              onChange={(emoji) => set({ emoji })}
              list={EMOJI}
              colorKey={color}
              cols={10}
              size={17}
              maxHeight={132}
            />
          </Field>

          <Field label="Цвет">
            <div className="flex flex-wrap gap-2.5">
              {COLOR_KEYS.map((k) => (
                <button
                  key={k}
                  onClick={() => set({ color: k })}
                  className="w-9 h-9 rounded-full press"
                  style={{
                    background: hex(k),
                    boxShadow: form.color === k ? `0 0 0 2.5px #111116, 0 0 0 4.5px ${hex(k)}` : "none",
                  }}
                  aria-label={COLORS[k].label}
                />
              ))}
            </div>
          </Field>

          <button
            onClick={() => set({ priority: form.priority ? 0 : 1 })}
            className="press w-full py-3 rounded-2xl text-[14px] font-semibold flex items-center justify-center gap-2"
            style={{
              background: form.priority ? rgba(color, 0.2) : "rgba(255,255,255,.05)",
              border: `1px solid ${form.priority ? rgba(color, 0.4) : "rgba(255,255,255,.08)"}`,
            }}
          >
            ❗️ Очень хочу
          </button>

          <Button onClick={save} disabled={busy || !form.title.trim()} colorKey={color}>
            {editing ? "Сохранить" : "Добавить в вишлист"}
          </Button>

          {editing && (
            <>
              {item.url && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="press block w-full py-3.5 rounded-2xl bg-white/8 text-[15px] font-bold text-center"
                >
                  Открыть {hostOf(item.url)}
                </a>
              )}

              {/* дарит партнёр — свою хотелку закрывать самому смысла нет */}
              {!mine && (
                <Button
                  variant="ghost"
                  onClick={() => { toggleWishItemGot(item); onClose(); }}
                >
                  {item.status === "got" ? "Всё-таки не подарено" : "Подарено 🎉"}
                </Button>
              )}

              {item.status === "got" && item.got_at && (
                <div className="text-center text-[12.5px] text-white/35">
                  Подарено {humanDateFull(item.got_at)}
                </div>
              )}

              <Button variant="danger" onClick={remove}>
                {confirmDelete ? "Точно удалить?" : "Удалить"}
              </Button>
            </>
          )}
        </div>
      </div>
    </Sheet>
  );
}
