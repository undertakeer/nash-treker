import { useEffect, useState } from "react";
import Sheet from "../components/Sheet";
import { Button, Card, Row, Switch } from "../components/ui";
import { useStore } from "../lib/store";
import {
  disablePush, enablePush, isIOS, isStandalone, pushState, sendTestPush, subscriptionCount,
} from "../lib/push";

export default function Notifications({ open, onClose }) {
  const { prefs, updatePrefs, uid, habits, updateHabit, showToast } = useStore();
  const [state, setState] = useState("checking");
  const [busy, setBusy] = useState(false);
  const [devices, setDevices] = useState(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    if (!open) return;
    pushState().then(setState);
    subscriptionCount(uid).then(setDevices);
    setTestResult(null);
  }, [open, uid]);

  async function runTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await sendTestPush();
      setTestResult(
        res?.sent
          ? { ok: true, text: "Отправлено. Уведомление придёт в течение пары секунд." }
          : { ok: false, text: "Сервер сработал, но отправлять некуда: это устройство не подписано. Нажмите «Включить» выше." }
      );
    } catch (e) {
      setTestResult({ ok: false, text: e.message });
    } finally {
      setTesting(false);
      subscriptionCount(uid).then(setDevices);
    }
  }

  async function toggle() {
    setBusy(true);
    try {
      if (state === "on") {
        await disablePush();
        setState("off");
        showToast("Уведомления выключены", "🔕");
      } else {
        await enablePush(uid);
        setState("on");
        showToast("Уведомления включены", "🔔");
      }
    } catch (e) {
      showToast(e.message, "⚠️");
    } finally {
      setBusy(false);
    }
  }

  const p = prefs || {};
  const withReminders = habits.filter((h) => h.status === "active" && h.reminder_enabled);

  return (
    <Sheet open={open} onClose={onClose} tall>
      <div className="px-5 pb-12">
        <div className="flex items-center justify-between py-3">
          <button onClick={onClose} className="press text-[15px] text-white/50 font-medium">Закрыть</button>
          <div className="text-[15px] font-bold">Уведомления</div>
          <span className="w-14" />
        </div>

        {state === "unsupported" && (
          <Note emoji="🚫" text="Этот браузер не умеет push-уведомления. На iPhone откройте приложение с домашнего экрана." />
        )}
        {state === "not-configured" && (
          <Note emoji="🔧" text="VAPID-ключ не задан в config.js. Пуши включатся, как только он появится." />
        )}
        {state === "denied" && (
          <Note emoji="🔕" text="Уведомления запрещены в настройках телефона. Настройки → Уведомления → Наш трекер." />
        )}
        {isIOS() && !isStandalone() && (
          <Note emoji="📲" text="На iPhone пуши работают только у приложения с домашнего экрана: «Поделиться» → «На экран Домой»." />
        )}

        <Card className="mb-5">
          <div className="flex items-center justify-between px-4 py-4">
            <div>
              <div className="text-[15px] font-bold">Push на это устройство</div>
              <div className="text-[13px] text-white/40">
                {state === "on" ? "Включены" : state === "off" ? "Выключены" : "…"}
              </div>
            </div>
            <Button
              onClick={toggle}
              disabled={busy || ["unsupported", "not-configured", "denied", "checking"].includes(state)}
              variant={state === "on" ? "ghost" : "primary"}
              full={false}
              className="px-5 py-2.5"
            >
              {state === "on" ? "Выключить" : "Включить"}
            </Button>
          </div>
        </Card>

        <h3 className="text-[13px] font-bold tracking-[0.1em] uppercase text-white/30 mb-2.5 px-1">Проверка</h3>
        <Card className="divide-y divide-white/6 mb-5">
          <CheckRow
            ok={!isIOS() || isStandalone()}
            label="Открыто с домашнего экрана"
            hint="На iPhone из вкладки Safari пуши не работают вообще — только у приложения с иконкой."
          />
          <CheckRow
            ok={state === "on"}
            label="Телефон подписан"
            hint={state === "denied"
              ? "Разрешение отозвано: Настройки → Уведомления → Наш трекер."
              : "Кнопка «Включить» выше."}
          />
          <CheckRow
            ok={devices > 0}
            label={devices === null ? "Устройств в базе: …" : `Устройств в базе: ${devices}`}
            hint="Сюда записывается каждый телефон, где вы включили уведомления."
          />
          <div className="px-4 py-4">
            <Button onClick={runTest} disabled={testing} variant="ghost">
              {testing ? "Отправляем…" : "Прислать тестовое"}
            </Button>
            {testResult && (
              <div
                className="mt-3 text-[13px] leading-relaxed"
                style={{ color: testResult.ok ? "rgba(255,255,255,.6)" : "#FF9A8B" }}
              >
                {testResult.ok ? "✅ " : "⚠️ "}{testResult.text}
              </div>
            )}
          </div>
        </Card>

        <h3 className="text-[13px] font-bold tracking-[0.1em] uppercase text-white/30 mb-2.5 px-1">Что присылать</h3>
        <Card className="divide-y divide-white/6 mb-5">
          <Toggle label="Напоминания о привычках" hint="В заданное для привычки время"
            value={p.reminders !== false} onChange={(v) => updatePrefs({ reminders: v })} />
          <Toggle label="Партнёр отметился" hint="Когда вторая половина закрывает общую привычку"
            value={p.partner_checkins !== false} onChange={(v) => updatePrefs({ partner_checkins: v })} />
          <Toggle label="Задачи со сроком" hint="В указанное для задачи время"
            value={p.task_reminders !== false} onChange={(v) => updatePrefs({ task_reminders: v })} />
          <Toggle label="Приём препаратов" hint="В каждое время приёма и о вехах курса"
            value={p.med_reminders !== false} onChange={(v) => updatePrefs({ med_reminders: v })} />
          <Toggle label="Новое место на карте" hint="Когда партнёр отмечает точку"
            value={p.places !== false} onChange={(v) => updatePrefs({ places: v })} />
          <Toggle label="Партнёр обогнал" hint="Через пару часов после того, как он закрыл общую привычку"
            value={p.smart_nudge !== false} onChange={(v) => updatePrefs({ smart_nudge: v })} />
          <Toggle label="Стрик под угрозой" hint="Вечером, если привычка ещё не отмечена"
            value={p.streak_risk !== false} onChange={(v) => updatePrefs({ streak_risk: v })} />
          <Toggle label="Подталкивания" hint="Когда партнёр напоминает о вашей привычке"
            value={p.nudges !== false} onChange={(v) => updatePrefs({ nudges: v })} />
          <Toggle label="Итоги недели" hint="Воскресенье вечером"
            value={p.weekly_summary !== false} onChange={(v) => updatePrefs({ weekly_summary: v })} />
        </Card>

        <h3 className="text-[13px] font-bold tracking-[0.1em] uppercase text-white/30 mb-2.5 px-1">Тихие часы</h3>
        <Card className="divide-y divide-white/6 mb-5">
          <TimeRow label="Не беспокоить с" value={p.quiet_from} onChange={(v) => updatePrefs({ quiet_from: v })} />
          <TimeRow label="До" value={p.quiet_to} onChange={(v) => updatePrefs({ quiet_to: v })} />
          <TimeRow label="Проверять стрик в" value={p.streak_risk_time} onChange={(v) => updatePrefs({ streak_risk_time: v })} />
        </Card>

        <h3 className="text-[13px] font-bold tracking-[0.1em] uppercase text-white/30 mb-2.5 px-1">
          Напоминания по привычкам
        </h3>
        <Card className="divide-y divide-white/6">
          {habits.filter((h) => h.status === "active").length === 0 && (
            <div className="px-4 py-6 text-center text-[14px] text-white/35">Пока нет активных привычек</div>
          )}
          {habits
            .filter((h) => h.status === "active")
            .map((h) => (
              <div key={h.id} className="flex items-center gap-3 px-4 py-3">
                <span className="text-[18px]">{h.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[14.5px] font-semibold truncate">{h.title}</div>
                  <div className="text-[12.5px] text-white/35">
                    {h.reminder_enabled ? `в ${(h.reminder_time || "09:00").slice(0, 5)}` : "без напоминания"}
                  </div>
                </div>
                {h.reminder_enabled && (
                  <input
                    type="time"
                    value={(h.reminder_time || "09:00").slice(0, 5)}
                    onChange={(e) => updateHabit(h.id, { reminder_time: e.target.value })}
                    className="bg-white/8 rounded-lg px-2 py-1 text-[13.5px] font-semibold outline-none"
                  />
                )}
                <Switch
                  checked={Boolean(h.reminder_enabled)}
                  onChange={(v) => updateHabit(h.id, { reminder_enabled: v })}
                />
              </div>
            ))}
        </Card>

        {withReminders.length > 0 && state !== "on" && (
          <div className="text-[12.5px] text-white/30 mt-4 px-1 leading-relaxed">
            Напоминания настроены у {withReminders.length} привычек, но push на этом устройстве выключен —
            уведомления не придут.
          </div>
        )}
      </div>
    </Sheet>
  );
}

function Toggle({ label, hint, value, onChange }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3.5">
      <div className="min-w-0">
        <div className="text-[15px] font-semibold">{label}</div>
        {hint && <div className="text-[12.5px] text-white/35 leading-snug">{hint}</div>}
      </div>
      <Switch checked={value} onChange={onChange} />
    </div>
  );
}

function TimeRow({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5">
      <div className="text-[15px] font-semibold">{label}</div>
      <input
        type="time"
        value={(value || "00:00").slice(0, 5)}
        onChange={(e) => onChange(e.target.value)}
        className="bg-white/8 rounded-xl px-3 py-1.5 text-[15px] font-semibold outline-none"
      />
    </div>
  );
}

function CheckRow({ ok, label, hint }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3.5">
      <span className="text-[15px] leading-6 shrink-0">{ok ? "✅" : "⚠️"}</span>
      <div className="min-w-0">
        <div className="text-[14.5px] font-semibold">{label}</div>
        {!ok && hint && <div className="text-[12.5px] text-white/40 mt-0.5 leading-relaxed">{hint}</div>}
      </div>
    </div>
  );
}

function Note({ emoji, text }) {
  return (
    <div className="flex gap-3 px-4 py-3.5 rounded-2xl bg-amber-400/8 border border-amber-400/15 mb-4">
      <span className="text-[17px]">{emoji}</span>
      <span className="text-[13px] text-amber-100/75 leading-relaxed">{text}</span>
    </div>
  );
}
