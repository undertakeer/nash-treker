import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { StoreProvider, useStore } from "./lib/store";
import Auth from "./screens/Auth";
import Home from "./screens/Home";
import Together from "./screens/Together";
import Profile from "./screens/Profile";
import HabitDetail from "./screens/HabitDetail";
import HabitEditor from "./screens/HabitEditor";
import Notifications from "./screens/Notifications";
import TabBar from "./components/TabBar";
import Toast from "./components/Toast";
import Confetti from "./components/Confetti";
import InstallHint from "./components/InstallHint";

function Shell() {
  const { session, toast, online, pendingCount } = useStore();
  const [tab, setTab] = useState("home");
  const [openHabit, setOpenHabit] = useState(null);
  const [editor, setEditor] = useState({ open: false, habit: null });
  const [notifOpen, setNotifOpen] = useState(false);
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

  return (
    <div className="min-h-full max-w-[520px] mx-auto">
      {(!online || pendingCount > 0) && (
        <div className="sticky top-0 z-30 text-center text-[12px] font-semibold py-1.5 bg-amber-400/12 text-amber-200/85 backdrop-blur-md">
          {online
            ? `Досинхронизируем ${pendingCount} отметок…`
            : "Офлайн — отметки сохранятся и уедут позже"}
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.main
          key={tab}
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
          {tab === "together" && <Together />}
          {tab === "profile" && <Profile onOpenNotifications={() => setNotifOpen(true)} />}
        </motion.main>
      </AnimatePresence>

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
