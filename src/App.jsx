import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { StoreProvider, useStore } from "./lib/store";
import { visibleTabs } from "./lib/tabs";
import Auth from "./screens/Auth";
import Home from "./screens/Home";
import Today from "./screens/Today";
import Tasks from "./screens/Tasks";
import MapScreen from "./screens/MapScreen";
import Treatment from "./screens/Treatment";
import Money, { MoneyOps } from "./screens/Money";
import TaskEditor from "./screens/TaskEditor";
import PlaceEditor from "./screens/PlaceEditor";
import MedEditor from "./screens/MedEditor";
import MedEventEditor from "./screens/MedEventEditor";
import PlaceDetail from "./screens/PlaceDetail";
import Together from "./screens/Together";
import Gallery from "./screens/Gallery";
import Shop from "./screens/Shop";
import Wishlist from "./screens/Wishlist";
import Goals from "./screens/Goals";
import MonthSummary from "./screens/MonthSummary";
import Profile from "./screens/Profile";
import HabitDetail from "./screens/HabitDetail";
import HabitEditor from "./screens/HabitEditor";
import Notifications from "./screens/Notifications";
import TabBar from "./components/TabBar";
import Toast from "./components/Toast";
import Confetti from "./components/Confetti";
import InstallHint from "./components/InstallHint";

function Shell() {
  const { session, toast, online, pendingCount, places, tabs } = useStore();
  const [tab, setTab] = useState("home");
  const [openHabit, setOpenHabit] = useState(null);
  const [editor, setEditor] = useState({ open: false, habit: null });
  const [notifOpen, setNotifOpen] = useState(false);
  const [modal, setModal] = useState(null); // gallery | wishlist | shop | goals | summary
  const [taskEditor, setTaskEditor] = useState({ open: false, task: null });
  const [placeEditor, setPlaceEditor] = useState({ open: false, place: null, draft: null });
  const [openPlace, setOpenPlace] = useState(null);
  const [medEditor, setMedEditor] = useState({ open: false, med: null });
  const [medEventEditor, setMedEventEditor] = useState({ open: false, item: null });
  const [opsOpen, setOpsOpen] = useState(false);
  const [burst, setBurst] = useState(null);

  const fireBurst = useCallback((colorKey) => {
    setBurst({ colorKey, id: Math.random() });
    setTimeout(() => setBurst(null), 900);
  }, []);

  useEffect(() => {
    document.documentElement.style.background = "#08080B";
  }, []);

  const tabIds = useMemo(() => visibleTabs(tabs), [tabs]);

  // вкладку могли только что спрятать в настройках — уводим на первую видимую
  useEffect(() => {
    if (!tabIds.includes(tab)) setTab(tabIds[0]);
  }, [tabIds, tab]);

  if (session === undefined) {
    return (
      <div className="min-h-full grid place-items-center">
        <div className="text-[28px] animate-pulse">🎰</div>
      </div>
    );
  }

  if (!session) return <Auth />;

  // Оболочка прибита к вьюпорту через fixed inset-0, а не через 100dvh:
  // единицы vh/dvh на iOS расходятся с тем, что считает fixed, и таб-бар
  // уезжал под край. Прокрутка живёт только внутри main, поэтому документ
  // не скроллится и панели Safari не пляшут.
  return (
    <div className="fixed inset-0 flex flex-col max-w-[520px] mx-auto overflow-hidden">
      {(!online || pendingCount > 0) && (
        <div className="relative z-30 shrink-0 text-center text-[12px] font-semibold py-1.5 bg-amber-400/12 text-amber-200/85">
          {online
            ? `Досинхронизируем ${pendingCount} отметок…`
            : "Офлайн — отметки сохранятся и уедут позже"}
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.main
          key={tab}
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain no-scrollbar"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          {tab === "home" && (
            <Home
              onOpenHabit={setOpenHabit}
              onCreate={() => setEditor({ open: true, habit: null })}
              onBurst={fireBurst}
            />
          )}
          {tab === "today" && <Today onOpenHabit={setOpenHabit} onBurst={fireBurst} />}
          {tab === "tasks" && (
            <Tasks
              onOpenTask={(t) => setTaskEditor({ open: true, task: t })}
              onCreate={() => setTaskEditor({ open: true, task: null })}
              onBurst={fireBurst}
            />
          )}
          {tab === "meds" && (
            <Treatment
              onOpenMed={(m) => setMedEditor({ open: true, med: m })}
              onCreateMed={() => setMedEditor({ open: true, med: null })}
              onOpenEvent={(e) => setMedEventEditor({ open: true, item: e })}
              onCreateEvent={() => setMedEventEditor({ open: true, item: null })}
              onBurst={fireBurst}
            />
          )}
          {tab === "money" && <Money onOpenOps={() => setOpsOpen(true)} />}
          {tab === "map" && (
            <MapScreen
              onCreateAt={(pos) => setPlaceEditor({ open: true, place: null, draft: pos })}
              onOpenPlace={setOpenPlace}
            />
          )}
          {tab === "together" && <Together onOpen={setModal} />}
          {tab === "profile" && (
            <Profile onOpenNotifications={() => setNotifOpen(true)} onOpen={setModal} />
          )}
        </motion.main>
      </AnimatePresence>

      {/* и под самим приложением тоже: тот же фон ниже видимого низа */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 bottom-0 h-40 translate-y-full"
        style={{ background: "var(--color-ink)" }}
      />

      {/* верхняя растушёвка под статус-баром */}
      <div aria-hidden className="edge-fade-top pointer-events-none fixed inset-x-0 top-0 z-20" />

      <TabBar tab={tab} onChange={setTab} ids={tabIds} />
      <InstallHint />

      {openHabit && (
        <HabitDetail
          habitId={openHabit}
          onClose={() => setOpenHabit(null)}
          onEdit={(h) => { setOpenHabit(null); setTimeout(() => setEditor({ open: true, habit: h }), 260); }}
          onBurst={fireBurst}
        />
      )}

      <HabitEditor
        open={editor.open}
        habit={editor.habit}
        onClose={() => setEditor({ open: false, habit: null })}
      />

      <Notifications open={notifOpen} onClose={() => setNotifOpen(false)} />
      <TaskEditor
        open={taskEditor.open}
        task={taskEditor.task}
        onClose={() => setTaskEditor({ open: false, task: null })}
      />

      {openPlace && (
        <PlaceDetail
          place={places.find((p) => p.id === openPlace.id) || openPlace}
          onClose={() => setOpenPlace(null)}
          onEdit={(p) => {
            setOpenPlace(null);
            setTimeout(() => setPlaceEditor({ open: true, place: p, draft: null }), 260);
          }}
        />
      )}

      <PlaceEditor
        open={placeEditor.open}
        place={placeEditor.place}
        draft={placeEditor.draft}
        onClose={() => setPlaceEditor({ open: false, place: null, draft: null })}
      />

      <MedEditor
        open={medEditor.open}
        med={medEditor.med}
        onClose={() => setMedEditor({ open: false, med: null })}
      />
      <MedEventEditor
        open={medEventEditor.open}
        item={medEventEditor.item}
        onClose={() => setMedEventEditor({ open: false, item: null })}
      />
      <MoneyOps open={opsOpen} onClose={() => setOpsOpen(false)} />
      <Gallery open={modal === "gallery"} onClose={() => setModal(null)} />
      <Shop open={modal === "shop"} onClose={() => setModal(null)} />
      <Wishlist open={modal === "wishlist"} onClose={() => setModal(null)} />
      <Goals open={modal === "goals"} onClose={() => setModal(null)} />
      <MonthSummary open={modal === "summary"} onClose={() => setModal(null)} />

      {burst && <Confetti key={burst.id} colorKey={burst.colorKey} />}
      <Toast toast={toast} />
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
