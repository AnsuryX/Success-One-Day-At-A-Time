import { useState, useEffect } from "react";
import {
  UtensilsCrossed,
  Activity,
  Users,
  Pill,
  Smile,
  Target,
  Trees,
  Sparkles,
  HeartHandshake,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Trash2,
  CalendarDays,
  Printer,
  FileCheck2,
  Layers,
  Award,
  BookOpen,
  Info,
  Sparkle,
  Wifi,
  WifiOff,
  Download
} from "lucide-react";

import { DailyEntry, ToDoItem, MadeTimeFields } from "./types";
import { SUCCESS_HABITS, HEALTHY_MIND_SPIRIT, MADE_TIME_ITEMS, getEmptyEntry, MOTIVATIONAL_QUOTES } from "./constants";
import MeditationTimer from "./components/MeditationTimer";
import AnalyticsDashboard from "./components/AnalyticsDashboard";

// Firebase imports integration
import { auth, db, handleFirestoreError, OperationType } from "./firebase";
import {
  signInWithPopup,
  signOut,
  GoogleAuthProvider,
  onAuthStateChanged,
  User as FirebaseUser
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  onSnapshot,
  serverTimestamp,
  writeBatch
} from "firebase/firestore";

// Dynamic map for rendering icons based on string keys
const iconMap = {
  UtensilsCrossed: UtensilsCrossed,
  Activity: Activity,
  Users: Users,
  Pill: Pill,
  Smile: Smile,
  Target: Target,
  Trees: Trees,
  Sparkles: Sparkles,
  HeartHandshake: HeartHandshake,
};

export default function App() {
  const [currentDate, setCurrentDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });

  const [allEntries, setAllEntries] = useState<{ [key: string]: DailyEntry }>(() => {
    const raw = localStorage.getItem("planner_entries_v1");
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (e) {
        console.error("Error reading saved entries", e);
      }
    }
    return {};
  });

  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Progressive Web App (PWA) State configuration
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== "undefined" ? navigator.onLine : true;
  });
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  
  // Date-anchored shufflable quotes selection
  const [activeQuoteIdx, setActiveQuoteIdx] = useState<number>(() => {
    const d = new Date().getDate();
    return d % MOTIVATIONAL_QUOTES.length;
  });

  // PWA & Connection monitor setup
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const handleBeforeInstallPr = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPr);

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPr);
    };
  }, []);

  const triggerPWAInstall = async () => {
    if (!deferredPrompt) {
      alert("PWA installer prompt is not prepared. If you are on desktop, check your search bar area for the install symbol. Standard browsers allow installation directly from their options settings.");
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  // Sync with Auth state change
  useEffect(() => {
    let unsubscribeFirestore: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false);

      if (user) {
        // Subscribe to real-time entries collection on Firestore
        const entriesRef = collection(db, "users", user.uid, "entries");
        unsubscribeFirestore = onSnapshot(
          entriesRef,
          (snapshot) => {
            const fetched: { [key: string]: DailyEntry } = {};
            snapshot.forEach((doc) => {
              fetched[doc.id] = doc.data() as DailyEntry;
            });
            setAllEntries((prev) => {
              // Ensure if local entries are newer we don't discard them, but firestore is source of truth
              return fetched;
            });
          },
          (error) => {
            handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/entries`);
          }
        );
      } else {
        // Clean up Firestore subscription if signed out and load localStorage fallback
        if (unsubscribeFirestore) {
          unsubscribeFirestore();
          unsubscribeFirestore = null;
        }
        const raw = localStorage.getItem("planner_entries_v1");
        if (raw) {
          try {
            setAllEntries(JSON.parse(raw));
          } catch (e) {
            console.error(e);
          }
        } else {
          setAllEntries({});
        }
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
      }
    };
  }, []);

  // Merge local offline entries to Firestore upon user pairing
  const mergeUnsyncedToFirestore = async (user: FirebaseUser, localData: { [key: string]: DailyEntry }) => {
    const dates = Object.keys(localData);
    if (dates.length === 0) return;

    try {
      // 1. First ensure User Profile Document exists (Required by firestore.rules rules)
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email || "",
          displayName: user.displayName || "",
          photoURL: user.photoURL || "",
          createdAt: serverTimestamp()
        });
      }

      // 2. Write offline local entries using writeBatch
      const batch = writeBatch(db);
      let needsCommit = false;

      for (const d of dates) {
        const entryRef = doc(db, "users", user.uid, "entries", d);
        batch.set(
          entryRef,
          {
            ...localData[d],
            userId: user.uid,
            updatedAt: serverTimestamp()
          },
          { merge: true }
        );
        needsCommit = true;
      }

      if (needsCommit) {
        await batch.commit();
        console.log("Successfully backfilled offline success entries to Cloud FS.");
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, `users/${user.uid}`);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      if (result.user) {
        // Ensure user profile document exists
        const userRef = doc(db, "users", result.user.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          await setDoc(userRef, {
            uid: result.user.uid,
            email: result.user.email || "",
            displayName: result.user.displayName || "",
            photoURL: result.user.photoURL || "",
            createdAt: serverTimestamp()
          });
        }

        // Try to backfill offline items
        const rawLocal = localStorage.getItem("planner_entries_v1");
        if (rawLocal) {
          try {
            const parsed = JSON.parse(rawLocal);
            await mergeUnsyncedToFirestore(result.user, parsed);
          } catch (e) {
            console.error("Failed to merge offline entries", e);
          }
        }
      }
    } catch (error) {
      console.error("Google login authentication failed", error);
      alert("Google log in failed. Please ensure popups are enabled.");
    }
  };

  const handleLogout = async () => {
    if (window.confirm("Are you sure you want to log out of your Cloud Backup session?")) {
      try {
        await signOut(auth);
      } catch (error) {
        console.error("Failed to sign out user", error);
      }
    }
  };

  const [activeEntry, setActiveEntry] = useState<DailyEntry>(() => {
    return getEmptyEntry(currentDate);
  });

  const [isMeditating, setIsMeditating] = useState(false);
  const [isShowingAnalytics, setIsShowingAnalytics] = useState(false);
  const [showDemoBanner, setShowDemoBanner] = useState(true);

  // Sync state with selected date change or list updates
  useEffect(() => {
    if (allEntries[currentDate]) {
      // Ensure all standard arrays exist to prevent potential migration errors
      const loaded = allEntries[currentDate];
      const normalized: DailyEntry = {
        ...getEmptyEntry(currentDate),
        ...loaded,
        priorities: {
          ...getEmptyEntry(currentDate).priorities,
          ...(loaded.priorities || {}),
          todo: loaded.priorities?.todo || getEmptyEntry(currentDate).priorities.todo,
        },
        habits: { ...getEmptyEntry(currentDate).habits, ...(loaded.habits || {}) },
        spirit: { ...getEmptyEntry(currentDate).spirit, ...(loaded.spirit || {}) },
        madeTimeFor: { ...getEmptyEntry(currentDate).madeTimeFor, ...(loaded.madeTimeFor || {}) },
      };
      setActiveEntry(normalized);
    } else {
      setActiveEntry(getEmptyEntry(currentDate));
    }
  }, [currentDate, allEntries]);

  // Check if historical backup suggests hiding the recommendation prompt
  useEffect(() => {
    const totalDays = Object.keys(allEntries).length;
    if (totalDays > 2) {
      setShowDemoBanner(false);
    }
  }, [allEntries]);

  // Handle nested updates safely and write to storage in real-time
  const updateEntry = (updater: (prev: DailyEntry) => DailyEntry) => {
    setActiveEntry((prev) => {
      const updated = updater(prev);
      const newAllEntries = { ...allEntries, [currentDate]: updated };
      setAllEntries(newAllEntries);
      localStorage.setItem("planner_entries_v1", JSON.stringify(newAllEntries));

      // Save to Firebase Firestore if logged in
      if (currentUser) {
        const entryRef = doc(db, "users", currentUser.uid, "entries", currentDate);
        setDoc(entryRef, {
          ...updated,
          userId: currentUser.uid,
          updatedAt: serverTimestamp()
        }, { merge: true }).catch((err) => {
          handleFirestoreError(err, OperationType.UPDATE, `users/${currentUser.uid}/entries/${currentDate}`);
        });
      }

      return updated;
    });
  };

  // Simple date selectors
  const navigateDay = (direction: number) => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + direction);
    setCurrentDate(d.toISOString().split("T")[0]);
  };

  const handleResetDay = () => {
    if (window.confirm("Are you sure you want to start fresh to clear inputs on this day?")) {
      updateEntry(() => getEmptyEntry(currentDate));
    }
  };

  const handleDeleteAll = () => {
    if (window.confirm("CRITICAL WARNING: This will permanently delete ALL entries in your success history. Do you wish to proceed?")) {
      setAllEntries({});
      localStorage.removeItem("planner_entries_v1");

      if (currentUser) {
        try {
          const batch = writeBatch(db);
          Object.keys(allEntries).forEach((d) => {
            const entryRef = doc(db, "users", currentUser.uid, "entries", d);
            batch.delete(entryRef);
          });
          batch.commit().catch((e) =>
            handleFirestoreError(e, OperationType.DELETE, `users/${currentUser.uid}/entries`)
          );
        } catch (e) {
          handleFirestoreError(e, OperationType.DELETE, `users/${currentUser.uid}/entries`);
        }
      }

      setCurrentDate(new Date().toISOString().split("T")[0]);
      window.location.reload();
    }
  };

  // Calculate days of the current week for the header preview box
  const getDaysOfWeek = () => {
    const active = new Date(currentDate);
    const dayIndex = active.getDay(); // 0 is Sun, 6 is Sat
    const startOfWeek = new Date(active);
    startOfWeek.setDate(active.getDate() - dayIndex);

    const days = [];
    const dayLetters = ["S", "M", "T", "W", "T", "F", "S"];

    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      const dateString = d.toISOString().split("T")[0];
      days.push({
        letter: dayLetters[i],
        dayOfMonth: d.getDate(),
        dateString,
        isCurrent: dateString === currentDate,
        isFuture: d.getTime() > new Date().getTime() && dateString !== new Date().toISOString().split("T")[0]
      });
    }
    return days;
  };

  const daysOfWeek = getDaysOfWeek();

  // Pre-fill demo data with funny, motivating realistic logs for quick evaluation of analytics
  const handlePreFillDemo = () => {
    const today = new Date();
    const demo: { [key: string]: DailyEntry } = {};

    // Generate last 7 days of success planner entries
    for (let i = 6; i >= 0; i--) {
      const tempDate = new Date();
      tempDate.setDate(today.getDate() - i);
      const dateStr = tempDate.toISOString().split("T")[0];

      demo[dateStr] = {
        date: dateStr,
        challenge: [
          "Complete all software unit test suites early",
          "Establish morning writing habits with strong concentration",
          "Focus on organic meals and sleep by 10 PM",
          "Refusal to overreact to production downtime anomalies",
          "Establish a solid workspace clean architecture layout",
          "Pitch core micro-services pitch to key partners",
          "Perform complete digital detox for brain renewal"
        ][i % 7],
        result: [
          "Completed in record time! Code coverage hits 95%",
          "Drafted 12 chapters of technical documentation details",
          "Enjoyed full plant-based salad recipe, slept with deep rest",
          "Maintained absolute poise, resolved server in 25 minutes",
          "Modularized everything cleanly with Inter typeface setup",
          "Received major interest! 3 clients signed term sheets",
          "Stayed fully offline and read books by the lake"
        ][i % 7],
        commitToGoals: true,
        commitMonths: "3",
        longTermGoals: [
          "Reach absolute mental and physical flow states weekly",
          "Deploy two responsive open-source applets using high aesthetic standards",
          "Deepen connection with close peers through outdoor events"
        ],
        priorities: {
          high: [
            ["Perform API integration perfectly", "Conduct client review mockups"][i % 2],
            ["Write robust test suites", "Design typography-focused headers"][i % 2]
          ],
          medium: [
            "Check for potential re-render bugs",
            "Update responsive padding on screens"
          ],
          todo: [
            { id: "1", text: "Answer all inbox queries", completed: i % 2 === 0 },
            { id: "2", text: "Water the indoor studio plants", completed: true },
            { id: "3", text: "Refactor static styles to theme", completed: i % 3 === 0 },
            { id: "4", text: "Review active code commits", completed: true },
            { id: "5", text: "Exercise in park", completed: i % 2 !== 0 },
            { id: "6", text: "Plan tomorrow's task schedules", completed: true }
          ]
        },
        habits: SUCCESS_HABITS.reduce((acc, _, idx) => {
          // Check roughly 60-80% of habits depending on days
          acc[idx] = (idx + i) % 3 !== 0;
          return acc;
        }, {} as { [key: string]: boolean }),
        spirit: HEALTHY_MIND_SPIRIT.reduce((acc, _, idx) => {
          // Check roughly 70-90% of mind checklist items
          acc[idx] = (idx * i + 3) % 4 !== 0;
          return acc;
        }, {} as { [key: string]: boolean }),
        checkIn: {
          didDoGoals: "Absolutely! Managed to keep the focus high all day.",
          supportiveThoughts: "I kept minor frustrations from clouding my long-term vision.",
          meditationDone: i % 2 === 0
        },
        madeTimeFor: {
          healthyFood: i % 2 === 0,
          yogaExercise: i % 3 !== 0,
          familyFriends: i % 2 !== 0,
          vitaminsMedicine: true,
          funHumor: true,
          workingGoals: true,
          quietNature: i % 4 !== 0,
          prayersSpirituality: i % 3 === 0,
          givingOthers: i % 4 === 0
        }
      };
    }

    const merged = { ...allEntries, ...demo };
    setAllEntries(merged);
    localStorage.setItem("planner_entries_v1", JSON.stringify(merged));
    setShowDemoBanner(false);

    if (currentUser) {
      try {
        const batch = writeBatch(db);
        Object.keys(demo).forEach((d) => {
          const entryRef = doc(db, "users", currentUser.uid, "entries", d);
          batch.set(
            entryRef,
            {
              ...demo[d],
              userId: currentUser.uid,
              updatedAt: serverTimestamp()
            },
            { merge: true }
          );
        });
        batch.commit().catch((e) =>
          handleFirestoreError(e, OperationType.CREATE, `users/${currentUser.uid}/entries`)
        );
      } catch (e) {
        handleFirestoreError(e, OperationType.CREATE, `users/${currentUser.uid}/entries`);
      }
    }

    alert("Successfully populated success logs for the past 7 days! Open the Analytics Dashboard to see trends.");
  };

  const getDayProgress = () => {
    // Habits completed
    const habitsChecked = Object.values(activeEntry.habits).filter(Boolean).length;
    // Spirit completed
    const spiritChecked = Object.values(activeEntry.spirit).filter(Boolean).length;
    // To-Do items completed
    const todoChecked = activeEntry.priorities.todo.filter(t => t.completed).length;

    const totalPossible = SUCCESS_HABITS.length + HEALTHY_MIND_SPIRIT.length + 6;
    const totalDone = habitsChecked + spiritChecked + todoChecked;

    return Math.round((totalDone / totalPossible) * 100);
  };

  const progressScore = getDayProgress();

  const handleCloudImport = async (importedData: { [key: string]: DailyEntry }) => {
    // Merge locally first
    const merged = { ...allEntries, ...importedData };
    setAllEntries(merged);
    localStorage.setItem("planner_entries_v1", JSON.stringify(merged));

    // Save to Firestore if authenticated
    if (currentUser) {
      try {
        const batch = writeBatch(db);
        Object.keys(importedData).forEach((d) => {
          const entryRef = doc(db, "users", currentUser.uid, "entries", d);
          batch.set(
            entryRef,
            {
              ...importedData[d],
              userId: currentUser.uid,
              updatedAt: serverTimestamp()
            },
            { merge: true }
          );
        });
        await batch.commit();
      } catch (e) {
        handleFirestoreError(e, OperationType.CREATE, `users/${currentUser.uid}/entries`);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-slate-800 font-sans p-4 md:p-8 no-print antialiased flex flex-col justify-between">
      {/* PWA App Install Booster Box */}
      {deferredPrompt && !isInstalled && (
        <div className="max-w-4xl mx-auto w-full mb-4 bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-900 border border-blue-400/30 p-4 rounded-2xl shadow-md flex flex-col sm:flex-row items-center justify-between gap-4 text-white hover:border-blue-400/50 transition-all relative overflow-hidden">
          {/* Decorative design accent */}
          <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-32 h-32 bg-blue-500/10 rounded-full blur-xl pointer-events-none" />
          
          <div className="flex items-center gap-3 z-10">
            <span className="bg-amber-400 text-slate-950 p-2.5 rounded-xl flex items-center justify-center animate-bounce shadow-md shrink-0">
              <Download size={18} className="stroke-3" />
            </span>
            <div>
              <h4 className="font-extrabold text-xs uppercase tracking-wider text-amber-300">
                Install Standalone Applet
              </h4>
              <p className="text-xs text-blue-100 mt-0.5">
                Add <strong>SuccessPlanner</strong> to your homescreen/desktop! Runs offline instantly, secures faster startup, and fits a clean distraction-free window.
              </p>
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto shrink-0 justify-end z-10" id="pwa-install-actions">
            <button
              onClick={() => setDeferredPrompt(null)}
              className="text-xs font-semibold text-slate-300 hover:text-white px-3 py-2 rounded-xl transition-all hover:bg-white/10 cursor-pointer"
            >
              Later
            </button>
            <button
              onClick={triggerPWAInstall}
              className="bg-amber-400 hover:bg-amber-300 text-slate-950 text-[10px] font-black uppercase tracking-wider py-2.5 px-4 rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer"
            >
              Install App
            </button>
          </div>
        </div>
      )}

      {/* Immersive Meditation Timer Modal Overlay */}
      {isMeditating && (
        <MeditationTimer
          onComplete={() => {
            updateEntry((prev) => ({
              ...prev,
              checkIn: {
                ...prev.checkIn,
                meditationDone: true
              }
            }));
          }}
          onClose={() => setIsMeditating(false)}
        />
      )}

      {/* Analytics trends Modal Overlay */}
      {isShowingAnalytics && (
        <AnalyticsDashboard
          entries={allEntries}
          onSelectDate={(date) => setCurrentDate(date)}
          onClose={() => setIsShowingAnalytics(false)}
          onImport={handleCloudImport}
        />
      )}

      {/* Demo Popover Prompt */}
      {showDemoBanner && (
        <div className="max-w-4xl mx-auto w-full mb-4 bg-indigo-50 border border-indigo-200/80 p-4 rounded-2xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="bg-indigo-600 text-white p-2.5 rounded-full flex items-center justify-center">
              <Award size={18} />
            </span>
            <div>
              <h4 className="font-bold text-sm text-indigo-950">Unlock Interactive History Trend Graphs</h4>
              <p className="text-xs text-indigo-800/80">
                You are on a blank canvas. Pre-fill 7 days of realistic planning logs to instantly unlock streaks, insights, and completion curves in the dashboard.
              </p>
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto shrink-0 justify-end">
            <button
              onClick={() => setShowDemoBanner(false)}
              className="text-xs font-semibold text-slate-400 hover:text-slate-600 px-3 py-2 rounded-xl transition-colors cursor-pointer"
            >
              Dismiss
            </button>
            <button
              onClick={handlePreFillDemo}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-xs hover:shadow-sm transition-all cursor-pointer"
              id="pref-demo-btn"
            >
              🌈 Pre-fill 7-day Log History
            </button>
          </div>
        </div>
      )}

      {/* Control Actions Ribbon (Date Selectors, Print, Analytics Launcher) */}
      <header className="max-w-4xl mx-auto w-full mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        {/* Date Walk Back & Forward */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateDay(-1)}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors cursor-pointer"
            title="Previous Day"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="relative flex items-center gap-1 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
            <CalendarDays size={16} className="text-blue-900" />
            <input
              type="date"
              value={currentDate}
              onChange={(e) => {
                if (e.target.value) setCurrentDate(e.target.value);
              }}
              className="font-mono text-xs font-bold bg-transparent outline-none cursor-pointer text-slate-800"
            />
          </div>
          <button
            onClick={() => navigateDay(1)}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors cursor-pointer"
            title="Next Day"
          >
            <ChevronRight size={18} />
          </button>
          <button
            onClick={() => setCurrentDate(new Date().toISOString().split("T")[0])}
            className={`text-xs px-2.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
              currentDate === new Date().toISOString().split("T")[0]
                ? "bg-blue-100/60 text-blue-900"
                : "bg-slate-50 hover:bg-slate-100 text-slate-500 border border-slate-200"
            }`}
          >
            Today
          </button>
        </div>

        {/* Global actions */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
          {/* Progressive Web App Network Status Indicator & Cloud Sync */}
          {!isOnline ? (
            <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1" title="Offline. Success logs are saved to your local browser storage and will backfill onto the cloud once back online.">
              <WifiOff size={11} className="text-amber-600" /> OFFLINE MODE
            </span>
          ) : currentUser ? (
            <span className="text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 animate-pulse" title="Connected to Google Cloud Firestore database in real-time.">
              <Wifi size={11} className="text-emerald-500" /> CLOUD SYNCED
            </span>
          ) : (
            <span className="text-[10px] text-[#1e3a8a] bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1" title="Online. Saving locally. Connect Google Cloud session above to synchronize logs.">
              <Wifi size={11} className="text-blue-500" /> LOCAL STATE
            </span>
          )}

          {/* User Sign In Profile Component */}
          {authLoading ? (
            <div className="text-slate-400 text-xs px-3 py-2">Auth loading...</div>
          ) : currentUser ? (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs shadow-3xs">
              {currentUser.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  referrerPolicy="no-referrer"
                  alt="User"
                  className="w-5 h-5 rounded-full border border-slate-350 shrink-0"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-[#1e3a8a] text-white flex items-center justify-center font-bold text-[10px] shrink-0 font-mono">
                  {currentUser.displayName?.[0] || currentUser.email?.[0] || "U"}
                </div>
              )}
              <span className="font-semibold text-slate-700 max-w-[100px] truncate" title={currentUser.displayName || currentUser.email || ""}>
                {currentUser.displayName || currentUser.email?.split("@")[0] || "Registered"}
              </span>
              <button
                onClick={handleLogout}
                className="ml-1 text-[#1e3a8a] hover:text-rose-600 transition-colors font-bold cursor-pointer text-[10px] uppercase border-l pl-2 border-slate-200 font-mono"
                title="Disconnect cloud state"
                id="signout-btn"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={handleGoogleLogin}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer font-sans"
              title="Backup your logs securely in Firestore cloud database"
              id="google-login-btn"
            >
              Sign In with Google
            </button>
          )}

          <button
            onClick={() => setIsShowingAnalytics(true)}
            className="flex items-center gap-1 px-4 py-2 bg-[#1e3a8a] hover:bg-indigo-900 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
            id="open-analytics-btn"
          >
            <Layers size={14} /> View Analytics Trends
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
            title="Print sheet to physical paper planner"
          >
            <Printer size={14} /> Print Section
          </button>
          <button
            onClick={handleResetDay}
            className="p-2 text-slate-400 hover:text-orange-600 bg-slate-50 hover:bg-orange-50 rounded-xl transition-colors border border-slate-200/60 cursor-pointer"
            title="Reset active day state"
            id="reset-day"
          >
            <RotateCcw size={16} />
          </button>
          <button
            onClick={handleDeleteAll}
            className="p-2 text-slate-300 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 rounded-xl transition-colors border border-slate-200/60 cursor-pointer"
            title="Wipe database cache"
            id="delete-all"
          >
            <Trash2 size={16} />
          </button>
        </div>

      </header>

      {/* Core Planner Container (Designed to look like physical high-quality card stock) */}
      <main className="max-w-4xl mx-auto w-full bg-white rounded-[2rem] border-2 border-slate-200 shadow-xl overflow-hidden relative flex flex-col p-6 md:p-8 space-y-6">
        
        {/* Success Score Badge Overlay */}
        <div className="absolute top-2 right-2 md:top-6 md:right-8 bg-gradient-to-tr from-slate-900 via-indigo-950 to-[#1e3a8a] text-white py-1 px-3 rounded-xl border border-white/10 flex items-center gap-2 shadow-sm font-mono text-[11px] font-bold tracking-tight">
          <FileCheck2 size={13} className="text-indigo-400" />
          <span>DAY COMPLETION RATE: {progressScore}%</span>
        </div>

        {/* 1. Header Ribbon Box */}
        <section className="flex flex-col md:flex-row justify-between items-stretch gap-4 border-b border-slate-200 pb-6 pt-2">
          
          {/* Main Royal Blue Ribbed Poly Header */}
          <div className="bg-[#1e3a8a] text-white p-5 rounded-2xl flex-1 flex flex-col justify-center min-h-[96px] shadow-sm relative overflow-hidden">
            {/* Inner background geometric subtle angle */}
            <div className="absolute -right-4 -bottom-4 w-28 h-28 bg-[#254c9b] rounded-full mix-blend-screen opacity-10 pointer-events-none" />
            <h2 className="text-xs uppercase tracking-widest font-bold text-blue-200 block font-display">
              Success Tracker & Journal
            </h2>
            <h1 className="text-3xl md:text-4xl font-black tracking-tighter uppercase leading-none font-display text-white mt-1">
              Success <span className="text-blue-300">One-Day-At-A-Time</span>
            </h1>
          </div>

          {/* Interactive Date Indicator Grid Block */}
          <div className="flex flex-col border border-[#1e3a8a]/30 rounded-2xl bg-[#eff6ff]/30 p-3 min-w-[240px] justify-between">
            <div className="grid grid-cols-7 gap-1 text-center font-mono">
              {daysOfWeek.map((day, i) => (
                <button
                  key={i}
                  disabled={day.isFuture}
                  onClick={() => setCurrentDate(day.dateString)}
                  className={`flex flex-col items-center justify-between p-1 rounded-md transition-all cursor-pointer ${
                    day.isFuture ? "opacity-30 cursor-not-allowed" : ""
                  } ${
                    day.isCurrent
                      ? "bg-[#1e3a8a] text-white scale-105 font-bold shadow-xs"
                      : "hover:bg-slate-200/60 text-slate-700"
                  }`}
                >
                  <span className="text-[9px] uppercase font-bold text-slate-400 font-sans tracking-wide">
                    {day.letter}
                  </span>
                  <span className="text-xs font-semibold mt-0.5">{day.dayOfMonth}</span>
                </button>
              ))}
            </div>
            
            <div className="mt-3 pt-2 border-t border-slate-200/50 flex justify-between items-center text-xs text-slate-500">
              <span className="font-semibold uppercase tracking-wider text-[10px] text-slate-400">Date Log:</span>
              <span className="font-mono font-bold text-[#1e3a8a]">{currentDate}</span>
            </div>
          </div>
        </section>

        {/* Daily Reflection Quote Card (Interactive PWA Accent) */}
        <section className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden transition-all duration-300">
          {/* Subtle quote outline in background */}
          <div className="absolute right-2 bottom-0 text-slate-100 font-serif text-[120px] font-bold select-none leading-none opacity-40 pointer-events-none">
            “
          </div>
          <div className="space-y-2 z-10 flex-1">
            <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping" />
              Today's Wisdom & Reflection Tip
            </div>
            <p className="text-sm font-medium text-slate-800 italic leading-relaxed">
              "{MOTIVATIONAL_QUOTES[activeQuoteIdx].text}"
            </p>
            <p className="text-xs text-slate-500 font-bold">
              — {MOTIVATIONAL_QUOTES[activeQuoteIdx].author}
            </p>
            <div className="text-xs bg-white text-slate-600 border border-slate-100/80 px-3.5 py-2 rounded-xl shadow-2xs font-sans mt-2.5 flex items-start gap-1.5">
              <span className="text-blue-600 font-bold shrink-0">💡 Reflection Tip:</span>
              <span>{MOTIVATIONAL_QUOTES[activeQuoteIdx].coachingTip}</span>
            </div>
          </div>
          
          <button
            onClick={() => {
              // Cycle through quotes list manually
              setActiveQuoteIdx((prev) => (prev + 1) % MOTIVATIONAL_QUOTES.length);
            }}
            className="md:self-center shrink-0 flex items-center gap-1 text-[10px] font-extrabold text-[#1e3a8a] bg-white hover:bg-slate-100 border border-slate-200 hover:border-slate-300 font-sans tracking-wider uppercase px-3.5 py-2.5 rounded-xl transition-all cursor-pointer shadow-3xs"
            title="Cycle motivational quotes"
            id="refresh-quote-btn"
          >
            🔄 Next Inspiration
          </button>
        </section>

        {/* 2. Challenge and Result Row */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col p-4 bg-white border border-[#1e3a8a]/20 rounded-2xl shadow-xs">
            <label className="text-xs font-bold text-[#1e3a8a] uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
              <span className="w-1.5 h-3 bg-blue-600 rounded-sm"></span>
              TODAY'S CHALLENGE:
            </label>
            <input
              type="text"
              value={activeEntry.challenge}
              onChange={(e) => updateEntry((prev) => ({ ...prev, challenge: e.target.value }))}
              placeholder="What core struggle or goal is today's primary test?"
              className="w-full text-slate-700 text-sm py-2 px-3 border border-slate-200 rounded-xl focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] outline-none transition-colors"
              id="today-challenge-input"
            />
          </div>

          <div className="flex flex-col p-4 bg-white border border-[#1e3a8a]/20 rounded-2xl shadow-xs">
            <label className="text-xs font-bold text-[#1e3a8a] uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
              <span className="w-1.5 h-3 bg-[#1e3a8a] rounded-sm"></span>
              Result:
            </label>
            <input
              type="text"
              value={activeEntry.result}
              onChange={(e) => updateEntry((prev) => ({ ...prev, result: e.target.value }))}
              placeholder="How did you perform? Note the outcome and lessons."
              className="w-full text-slate-700 text-sm py-2 px-3 border border-slate-200 rounded-xl focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] outline-none transition-colors"
              id="today-result-input"
            />
          </div>
        </section>

        {/* 3. My 1-3 Long Term Goals Banner */}
        <section className="bg-[#eff6ff]/40 border border-blue-150 rounded-2xl p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-blue-200 pb-2.5 gap-2">
            <h3 className="text-xs uppercase font-extrabold tracking-widest text-[#1e3a8a] flex items-center gap-1.5">
              <BookOpen size={14} className="text-[#1e3a8a]" />
              MY 1-3 LONG-TERM GOALS
            </h3>
            <div className="flex items-center gap-2.5">
              <label className="flex items-center gap-2 text-xs text-slate-600 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={activeEntry.commitToGoals}
                  onChange={(e) => updateEntry((prev) => ({ ...prev, commitToGoals: e.target.checked }))}
                  className="rounded border-slate-300 text-blue-900 focus:ring-blue-900 w-4 h-4 cursor-pointer"
                  id="commit-goals-checkbox"
                />
                <span>I commit to accomplishing these goals in</span>
              </label>
              <input
                type="text"
                placeholder="__"
                value={activeEntry.commitMonths}
                onChange={(e) => updateEntry((prev) => ({ ...prev, commitMonths: e.target.value }))}
                className="w-12 text-center p-1 border-b border-blue-900 text-xs font-extrabold text-[#1e3a8a] focus:outline-none"
                id="goals-months-input"
              />
              <span className="text-xs text-slate-600 font-medium">months</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {activeEntry.longTermGoals.map((val, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-blue-900/40">{idx + 1}</span>
                <input
                  type="text"
                  value={val}
                  onChange={(e) => {
                    const newGoals = [...activeEntry.longTermGoals];
                    newGoals[idx] = e.target.value;
                    updateEntry((prev) => ({ ...prev, longTermGoals: newGoals }));
                  }}
                  placeholder={`Long-term goal ${idx + 1}...`}
                  className="w-full text-slate-700 bg-transparent py-1 border-b border-dashed border-slate-200 hover:border-slate-300 focus:border-[#1e3a8a] outline-none text-xs transition-colors"
                  id={`long-term-goal-${idx}`}
                />
              </div>
            ))}
          </div>
        </section>

        {/* 4. Two Column Layout Grid (Goal Prioritizing, Habits, Mind Spirit, Check In) */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          
          {/* LEFT STRIP - Custom Priorities and Healthy Mind */}
          <div className="space-y-6">
            
            {/* PRIORITIZING TODAY'S GOALS Panel */}
            <div className="border border-[#1e3a8a]/20 rounded-2xl overflow-hidden shadow-xs">
              <div className="bg-[#1e3a8a] text-white px-4 py-3">
                <h3 className="text-xs uppercase font-extrabold tracking-wider">
                  PRIORITIZING TODAY'S GOALS
                </h3>
              </div>
              
              <div className="p-4 space-y-4 bg-white">
                {/* High priorities */}
                <div>
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-2 font-mono">
                    High:
                  </h4>
                  <div className="space-y-2">
                    {activeEntry.priorities.high.map((val, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="font-mono text-xs font-black text-slate-300">{idx + 1}</span>
                        <input
                          type="text"
                          value={val || ""}
                          onChange={(e) => {
                            const newHigh = [...activeEntry.priorities.high];
                            newHigh[idx] = e.target.value;
                            updateEntry((prev) => ({
                              ...prev,
                              priorities: { ...prev.priorities, high: newHigh }
                            }));
                          }}
                          placeholder={`Enter high priority goal ${idx+1}`}
                          className="w-full py-1.5 px-2.5 bg-slate-50 border border-slate-200 focus:border-[#1e3a8a] hover:bg-slate-50/50 rounded-lg outline-none text-xs text-slate-700"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Medium priorities */}
                <div>
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-2 font-mono">
                    Medium:
                  </h4>
                  <div className="space-y-2">
                    {activeEntry.priorities.medium.map((val, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="font-mono text-xs font-black text-slate-300">{idx + 1}</span>
                        <input
                          type="text"
                          value={val || ""}
                          onChange={(e) => {
                            const newMedium = [...activeEntry.priorities.medium];
                            newMedium[idx] = e.target.value;
                            updateEntry((prev) => ({
                              ...prev,
                              priorities: { ...prev.priorities, medium: newMedium }
                            }));
                          }}
                          placeholder={`Enter medium priority goal ${idx+1}`}
                          className="w-full py-1.5 px-2.5 bg-slate-50 border border-slate-200 focus:border-[#1e3a8a] hover:bg-slate-50/50 rounded-lg outline-none text-xs text-slate-700"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* General Lined To Do list */}
                <div>
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-2 font-mono">
                    To Do:
                  </h4>
                  <div className="space-y-2.5">
                    {activeEntry.priorities.todo.map((item, idx) => (
                      <div key={item.id} className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={item.completed}
                          onChange={(e) => {
                            const newTodo = activeEntry.priorities.todo.map(t =>
                              t.id === item.id ? { ...t, completed: e.target.checked } : t
                            );
                            updateEntry((prev) => ({
                              ...prev,
                              priorities: { ...prev.priorities, todo: newTodo }
                            }));
                          }}
                          className="w-4.5 h-4.5 text-[#1e3a8a] border-slate-300 rounded focus:ring-[#1e3a8a] cursor-pointer shrink-0"
                          id={`todo-check-${item.id}`}
                        />
                        <input
                          type="text"
                          value={item.text}
                          onChange={(e) => {
                            const newTodo = activeEntry.priorities.todo.map(t =>
                              t.id === item.id ? { ...t, text: e.target.value } : t
                            );
                            updateEntry((prev) => ({
                              ...prev,
                              priorities: { ...prev.priorities, todo: newTodo }
                            }));
                          }}
                          placeholder={`Todo action ${idx + 1}...`}
                          className={`w-full text-slate-700 text-xs bg-transparent border-b border-slate-100 hover:border-slate-200 focus:border-slate-300 py-0.5 outline-none transition-all ${
                            item.completed ? "line-through text-slate-400" : ""
                          }`}
                          id={`todo-text-${item.id}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* HEALTHY MIND, HEALTHY SPIRIT Panel */}
            <div className="border border-[#1e3a8a]/20 rounded-2xl overflow-hidden shadow-xs relative">
              
              {/* Decorative Subtle Watermark Background Ring */}
              <div className="absolute top-20 right-4 w-48 h-48 rounded-full border border-blue-900/5 flex items-center justify-center p-8 pointer-events-none">
                <div className="w-full h-full rounded-full bg-gradient-to-tr from-blue-900/2 to-indigo-900/2 border border-blue-900/10" />
              </div>

              <div className="bg-[#1e3a8a] text-white px-4 py-3">
                <h3 className="text-xs uppercase font-extrabold tracking-wider">
                  HEALTHY MIND, HEALTHY SPIRIT
                </h3>
              </div>

              <div className="p-4 space-y-2 bg-white relative z-10">
                {HEALTHY_MIND_SPIRIT.map((item, idx) => (
                  <label
                    key={idx}
                    className={`flex items-start gap-2.5 p-1 rounded-lg transition-colors cursor-pointer text-xs ${
                      activeEntry.spirit[idx]
                        ? "bg-emerald-50/40 text-emerald-950 font-medium"
                        : "hover:bg-slate-50 text-slate-700 font-normal"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={!!activeEntry.spirit[idx]}
                      onChange={(e) => {
                        updateEntry((prev) => {
                          const newSpirit = { ...prev.spirit, [idx]: e.target.checked };
                          return { ...prev, spirit: newSpirit };
                        });
                      }}
                      className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500 mt-0.5 cursor-pointer shrink-0"
                      id={`spirit-check-${idx}`}
                    />
                    <span className="leading-tight">{item}</span>
                  </label>
                ))}
              </div>
            </div>

          </div>

          {/* RIGHT STRIP - Habits for Success and Journaling Check-In */}
          <div className="space-y-6">
            
            {/* CULTIVATING HABITS FOR SUCCESS Panel */}
            <div className="border border-[#1e3a8a]/20 rounded-2xl overflow-hidden shadow-xs">
              <div className="bg-[#1e3a8a] text-white px-4 py-3">
                <h3 className="text-xs uppercase font-extrabold tracking-wider">
                  CULTIVATING HABITS FOR SUCCESS
                </h3>
              </div>

              <div className="p-4 space-y-2 bg-white">
                {SUCCESS_HABITS.map((habit, idx) => (
                  <label
                    key={idx}
                    className={`flex items-start gap-2.5 p-1 rounded-lg transition-colors cursor-pointer text-xs ${
                      activeEntry.habits[idx]
                        ? "bg-blue-50/40 text-blue-950 font-medium"
                        : "hover:bg-slate-50 text-slate-700 font-normal"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={!!activeEntry.habits[idx]}
                      onChange={(e) => {
                        updateEntry((prev) => {
                          const newHabits = { ...prev.habits, [idx]: e.target.checked };
                          return { ...prev, habits: newHabits };
                        });
                      }}
                      className="w-4 h-4 text-blue-900 border-slate-300 rounded focus:ring-blue-900 mt-0.5 cursor-pointer shrink-0"
                      id={`habit-check-${idx}`}
                    />
                    <span className="leading-tight">{habit}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* DAILY CHECK-IN Panel */}
            <div className="border border-[#1e3a8a]/20 rounded-2xl overflow-hidden bg-white shadow-xs p-5 space-y-4">
              <h3 className="text-xs uppercase font-extrabold tracking-widest text-[#1e3a8a]">
                DAILY CHECK-IN
              </h3>

              {/* Questions */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-slate-700 leading-normal block">
                    Did you do what you said you were going to do today? If not, why?
                  </span>
                  <textarea
                    rows={2}
                    value={activeEntry.checkIn.didDoGoals}
                    onChange={(e) => {
                      updateEntry((prev) => ({
                        ...prev,
                        checkIn: { ...prev.checkIn, didDoGoals: e.target.value }
                      }));
                    }}
                    placeholder="Log your accountability progress..."
                    className="w-full p-2.5 text-xs text-slate-700 border border-slate-200 rounded-xl focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] outline-none transition-all resize-none"
                    id="checkin-goals-textarea"
                  />
                </div>

                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-slate-700 leading-normal block">
                    Were you able to keep your thoughts supportive? Write down any repetitive thoughts that may have undermined your efforts.
                  </span>
                  <textarea
                    rows={2}
                    value={activeEntry.checkIn.supportiveThoughts}
                    onChange={(e) => {
                      updateEntry((prev) => ({
                        ...prev,
                        checkIn: { ...prev.checkIn, supportiveThoughts: e.target.value }
                      }));
                    }}
                    placeholder="Log your thoughts, worries or mental wins..."
                    className="w-full p-2.5 text-xs text-slate-700 border border-slate-200 rounded-xl focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a] outline-none transition-all resize-none"
                    id="checkin-thoughts-textarea"
                  />
                </div>
              </div>

              {/* Interactive 1-Minute Mediation Banner Block */}
              <div
                className={`p-3.5 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-3.5 transition-all ${
                  activeEntry.checkIn.meditationDone
                    ? "bg-blue-50/50 border-blue-200/80 text-[#1e3a8a]"
                    : "bg-[#1e3a8a] hover:bg-slate-900 border-transparent text-white shadow-md shadow-blue-900/10"
                }`}
              >
                <div className="flex items-center gap-2.5 text-center sm:text-left">
                  <input
                    type="checkbox"
                    checked={activeEntry.checkIn.meditationDone}
                    onChange={(e) => {
                      updateEntry((prev) => ({
                        ...prev,
                        checkIn: { ...prev.checkIn, meditationDone: e.target.checked }
                      }));
                    }}
                    className={`w-5 h-5 rounded-full cursor-pointer border ${
                      activeEntry.checkIn.meditationDone ? "text-[#1e3a8a] border-slate-300" : "text-white border-white/40"
                    }`}
                    id="meditation-done-checkbox"
                  />
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider flex items-center justify-center sm:justify-start gap-1">
                      <Sparkle size={13} className="animate-pulse" /> Did the 1-minute meditation challenge!
                    </h4>
                    <p className={`text-[10px] ${activeEntry.checkIn.meditationDone ? "text-slate-500" : "text-blue-150"}`}>
                      {activeEntry.checkIn.meditationDone ? "Success! Completed for today." : "Take 60 seconds to reset mental clarity."}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsMeditating(true)}
                  className={`text-[10px] font-extrabold uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-all shrink-0 cursor-pointer ${
                    activeEntry.checkIn.meditationDone
                      ? "bg-white text-[#1e3a8a] border-slate-200 hover:bg-slate-50"
                      : "bg-white text-slate-900 border-white hover:bg-white/90 shadow-sm"
                  }`}
                  id="trigger-meditation-timer"
                >
                  {activeEntry.checkIn.meditationDone ? "Retake Breathing Session" : "Start Breath Now"}
                </button>
              </div>

            </div>

          </div>

        </section>

        {/* 5. TODAY I MADE TIME FOR Horizonal Checkbox row */}
        <section className="border border-[#1e3a8a]/20 rounded-2xl bg-white overflow-hidden shadow-xs">
          <div className="bg-[#1e3a8a] text-white px-5 py-3 flex items-center justify-between">
            <h3 className="text-xs uppercase font-extrabold tracking-wider">
              TODAY I MADE TIME FOR:
            </h3>
            <span className="text-[10px] text-blue-200 font-mono font-bold uppercase">
              Select multiple actions
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 divide-x divide-y lg:divide-y-0 divide-slate-100 bg-white">
            {MADE_TIME_ITEMS.map((item) => {
              const Icon = iconMap[item.icon as keyof typeof iconMap];
              const isChecked = !!activeEntry.madeTimeFor[item.key as keyof MadeTimeFields];

              return (
                <button
                  key={item.key}
                  onClick={() => {
                    const nextVal = !isChecked;
                    updateEntry((prev) => ({
                      ...prev,
                      madeTimeFor: {
                        ...prev.madeTimeFor,
                        [item.key]: nextVal
                      }
                    }));
                  }}
                  className={`flex flex-col items-center justify-center p-4 transition-all hover:bg-slate-50 border-slate-150 text-center relative cursor-pointer ${
                    isChecked ? "bg-[#eff6ff]/40 text-blue-900" : "text-slate-500"
                  }`}
                  id={`made-time-btn-${item.key}`}
                >
                  <div className="absolute top-2 right-2">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      readOnly
                      className="w-3.5 h-3.5 rounded border-slate-300 pointer-events-none text-[#1e3a8a]"
                    />
                  </div>

                  <div className={`p-2 rounded-full mb-1.5 transition-colors ${isChecked ? "bg-white text-[#1e3a8a]" : "bg-slate-50 text-slate-400"}`}>
                    <Icon size={16} />
                  </div>

                  <span className="text-[9px] font-bold uppercase tracking-tight leading-tighter px-0.5">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* 6. Footer Ribbon bar banner */}
        <footer className="bg-[#1e3a8a] text-white rounded-2xl py-3 px-6 text-center shadow-xs">
          <p className="text-xs uppercase tracking-widest font-extrabold font-display">
            ★ Little Daily Actions Lead to Big Results ★
          </p>
        </footer>

      </main>

      {/* Info Tips Bottom section */}
      <footer className="max-w-4xl mx-auto w-full mt-6 text-center text-xs text-slate-400 font-medium">
        <p className="flex items-center justify-center gap-1">
          <Info size={13} className="text-slate-300" />
          <span>This interactive planner auto-saves in Real-Time to browser LocalStorage. Feel free to use on smartphone or computer.</span>
        </p>
      </footer>
    </div>
  );
}
