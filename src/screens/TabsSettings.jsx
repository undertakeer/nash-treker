import Sheet from "../components/Sheet";
import { Card, Switch } from "../components/ui";
import { useStore } from "../lib/store";
import { ALL_TABS, isLockedTab, visibleTabs } from "../lib/tabs";

export default function TabsSettings({ open, onClose }) {
  const { tabs, setTabs } = useStore();
  const shown = visibleTabs(tabs);

  function toggle(id) {
    const next = shown.includes(id) ? shown.filter((x) => x !== id) : [...shown, id];
    setTabs(visibleTabs(next));
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <div className="px-5 pb-10">
        <div className="flex items-center justify-between py-3">
          <button onClick={onClose} className="press text-[15px] text-white/50 font-medium">Закрыть</button>
          <div className="text-[15px] font-bold">Вкладки</div>
          <span className="w-14" />
        </div>

        <div className="text-[13px] text-white/40 leading-relaxed mb-4">
          Оставьте только нужные — лишние не будут занимать место в нижнем ряду.
          Настройка своя у каждого.
        </div>

        <Card className="divide-y divide-white/6">
          {ALL_TABS.map((t) => {
            const locked = isLockedTab(t.id);
            return (
              <div key={t.id} className="flex items-center justify-between px-4 py-3">
                <div className="text-[15px] font-semibold">{t.label}</div>
                {locked ? (
                  <span className="text-[12px] font-semibold text-white/25">обязательная</span>
                ) : (
                  <Switch checked={shown.includes(t.id)} onChange={() => toggle(t.id)} />
                )}
              </div>
            );
          })}
        </Card>
      </div>
    </Sheet>
  );
}
