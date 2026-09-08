import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { StoreProvider, useStore } from "./lib/store";
import Auth from "./screens/Auth";
import Home from "./screens/Home";
import Today from "./screens/Today";
import Tasks from "./screens/Tasks";
import MapScreen from "./screens/MapScreen";
import TaskEditor from "./screens/TaskEditor";
import PlaceEditor from "./screens/PlaceEditor";
import PlaceDetail from "./screens/PlaceDetail";
import Together from "./screens/Together";
import Gallery from "./screens/Gallery";
import Shop from "./screens/Shop";
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
  const { session, toast, online, pendingCount, places } = useStore();
  const [tab, setTab] = useState("home");
  const [openHabit, setOpenHabit] = useState(null);
  const [editor, setEditor] = useState({ open: false, habit: null });
  const [notifOpen, setNotifOpen] = useState(false);
  const [modal, setModal] = useState(null); // gallery | shop | goals | summary
  const [taskEditor, setTaskEditor] = useState({ open: false, task: null });
  const [placeEditor, setPlaceEditor] = useState({ open: false, place: null, draft: null });
  const [openPlace, setOpenPlace] = useState(null);
  const [burst, setBurst] = useState(null);

  const fireBurst = useCallback((colorKey) => {
    setBurst({ colorKey, id: Math.random() });
    setTimeout(() => setBurst(null), 900);
  }, []);

  useEffect(() => {
    document.documentElement.style.background = "#08080B";
  }, []);

  if (session === undefined) {
    return (
      <div className="min-h-full grid place-items-center">
        <div className="text-[28px] animate-pulse">🎰</div>
      </div>
    );
  }

  if (!session) return <Auth />;

  // Раскладка ровно в высоту экрана: шапка-баннер, прокручиваемая середина,
  // таб-бар обычным блоком снизу. Раньше таб-бар был position: fixed и на iOS
  // гулял по вертикали вместе с макетным вьюпортом.
  return (
    <div className="h-[100dvh] flex flex-col max-w-[520px] mx-auto">
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
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain no-scrollbar"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
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

      {/* верхняя растушёвка под статус-баром */}
      <div aria-hidden className="edge-fade-top pointer-events-none fixed inset-x-0 top-0 z-20" />

      <TabBar tab={tab} onChange={setTab} />
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
      <Gallery open={modal === "gallery"} onClose={() => setModal(null)} />
      <Shop open={modal === "shop"} onClose={() => setModal(null)} />
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
