import React, { useState, ChangeEvent } from "react";
import { DailyEntry } from "../types";
import { SUCCESS_HABITS, HEALTHY_MIND_SPIRIT } from "../constants";
import { motion } from "motion/react";
import {
  X,
  TrendingUp,
  Award,
  Calendar,
  Heart,
  ArrowRight,
  Download,
  Upload,
  BarChart2,
  CheckCircle,
  Clock
} from "lucide-react";

interface AnalyticsDashboardProps {
  entries: { [key: string]: DailyEntry };
  onClose: () => void;
  onSelectDate: (date: string) => void;
  onImport?: (imported: { [key: string]: DailyEntry }) => Promise<void>;
}

export default function AnalyticsDashboard({ entries, onClose, onSelectDate, onImport }: AnalyticsDashboardProps) {
  const [importError, setImportError] = useState<string | null>(null);

  const entryKeys = Object.keys(entries).sort();
  const totalDays = entryKeys.length;

  // 1. Compute streaks
  const calculateStreak = () => {
    if (totalDays === 0) return { current: 0, longest: 0 };
    const dates = entryKeys.map(d => new Date(d).getTime()).sort((a,b) => a-b);
    let maxStreak = 0;
    let currentStreak = 0;
    let prevTime: number | null = null;

    const oneDayMs = 24 * 60 * 60 * 1000;

    for (let i = 0; i < dates.length; i++) {
      if (prevTime === null) {
        currentStreak = 1;
      } else {
        const diff = Math.round((dates[i] - prevTime) / oneDayMs);
        if (diff === 1) {
          currentStreak++;
        } else if (diff > 1) {
          if (currentStreak > maxStreak) maxStreak = currentStreak;
          currentStreak = 1;
        }
      }
      prevTime = dates[i];
    }
    if (currentStreak > maxStreak) maxStreak = currentStreak;

    // Check if streak is current (ends today or yesterday)
    const today = new Date();
    today.setHours(0,0,0,0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const lastEntryDate = new Date(entryKeys[entryKeys.length - 1]);
    lastEntryDate.setHours(0,0,0,0);

    const isCurrent = lastEntryDate.getTime() === today.getTime() || lastEntryDate.getTime() === yesterday.getTime();
    const current = isCurrent ? currentStreak : 0;

    return { current, longest: maxStreak };
  };

  const streak = calculateStreak();

  // 2. Compute Habits Stats
  const habitCompletionCounts = SUCCESS_HABITS.map((habit, idx) => {
    let count = 0;
    entryKeys.forEach(date => {
      if (entries[date].habits[idx]) count++;
    });
    return { name: habit, count, percentage: totalDays > 0 ? Math.round((count / totalDays) * 100) : 0 };
  }).sort((a, b) => b.count - a.count);

  const topHabit = habitCompletionCounts[0];

  // 3. Compute Mind and Spirit Stats
  const spiritCompletionCounts = HEALTHY_MIND_SPIRIT.map((item, idx) => {
    let count = 0;
    entryKeys.forEach(date => {
      if (entries[date].spirit[idx]) count++;
    });
    return { name: item, count, percentage: totalDays > 0 ? Math.round((count / totalDays) * 100) : 0 };
  }).sort((a, b) => b.count - a.count);

  const topSpirit = spiritCompletionCounts[0];

  // Average completion score per day
  const getAverageHabitCompletion = () => {
    if (totalDays === 0) return 0;
    let totalChecked = 0;
    entryKeys.forEach(date => {
      const dayChecked = Object.values(entries[date].habits).filter(Boolean).length;
      totalChecked += dayChecked;
    });
    return Math.round((totalChecked / (totalDays * SUCCESS_HABITS.length)) * 100);
  };

  const getAverageSpiritCompletion = () => {
    if (totalDays === 0) return 0;
    let totalChecked = 0;
    entryKeys.forEach(date => {
      const dayChecked = Object.values(entries[date].spirit).filter(Boolean).length;
      totalChecked += dayChecked;
    });
    return Math.round((totalChecked / (totalDays * HEALTHY_MIND_SPIRIT.length)) * 100);
  };

  const avgHabits = getAverageHabitCompletion();
  const avgSpirit = getAverageSpiritCompletion();

  // 4. Time Made Space count
  const madeTimeCountMap = {
    healthyFood: 0,
    yogaExercise: 0,
    familyFriends: 0,
    vitaminsMedicine: 0,
    funHumor: 0,
    workingGoals: 0,
    quietNature: 0,
    prayersSpirituality: 0,
    givingOthers: 0,
  };

  entryKeys.forEach(date => {
    const fields = entries[date].madeTimeFor;
    if (fields) {
      Object.keys(madeTimeCountMap).forEach(key => {
        const k = key as keyof typeof madeTimeCountMap;
        if (fields[k]) madeTimeCountMap[k]++;
      });
    }
  });

  // Calculate percentage for made time options
  const madeTimeStats = Object.keys(madeTimeCountMap).map(key => {
    const k = key as keyof typeof madeTimeCountMap;
    const readable = key
      .replace(/([A-Z])/g, " $1")
      .toUpperCase()
      .trim();
    return {
      key: k,
      label: readable,
      count: madeTimeCountMap[k],
      percentage: totalDays > 0 ? Math.round((madeTimeCountMap[k] / totalDays) * 100) : 0
    };
  }).sort((a, b) => b.count - a.count);

  // Meditation completion count
  const meditationTotal = entryKeys.filter(date => entries[date].checkIn?.meditationDone).length;
  const meditationPercentage = totalDays > 0 ? Math.round((meditationTotal / totalDays) * 100) : 0;

  // JSON Import / Export
  const exportData = () => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(entries, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `daily_success_planner_backup_${new Date().toISOString().split("T")[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (e) {
      console.error(e);
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8");
      fileReader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          // Simple validation
          if (typeof parsed !== "object" || parsed === null) {
            throw new Error("Invalid file content format. Must be a JSON map of date string keys.");
          }
          const dates = Object.keys(parsed);
          for (let date of dates) {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
              throw new Error(`Invalid key formatting: '${date}'. Keys must be YYYY-MM-DD.`);
            }
          }
          
          if (onImport) {
            setImportError("Starting synchronization on Cloud Firestore backup...");
            onImport(parsed)
              .then(() => {
                setImportError("Import successful! Cloud database fully synchronized.");
                setTimeout(() => {
                  onClose();
                }, 1500);
              })
              .catch((err) => {
                setImportError("Local import succeeded, but cloud sync failed: " + err.message);
              });
          } else {
            // Merge or overwrite in localStorage
            const existing = { ...entries, ...parsed };
            localStorage.setItem("planner_entries_v1", JSON.stringify(existing));
            setImportError("Import successful! Reloading stats...");
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          }
        } catch (error: any) {
          setImportError(error.message || "Could not parse JSON file.");
        }
      };
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-xs overflow-y-auto p-4 md:p-6 lg:p-8 flex items-start justify-center">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-slate-50 w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-4"
      >
        {/* Header Ribbon */}
        <div className="bg-[#1e3a8a] text-white px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart2 size={24} className="text-blue-200" />
            <div>
              <h1 className="text-xl font-bold tracking-tight">Success Analytics Dashboard</h1>
              <p className="text-xs text-blue-200">Reflective tracking outputs and historical insights</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors text-blue-100 hover:text-white"
            id="close-analytics-top"
          >
            <X size={20} />
          </button>
        </div>

        {totalDays === 0 ? (
          <div className="p-12 text-center bg-white flex flex-col items-center justify-center min-h-[350px]">
            <Clock size={48} className="text-slate-300 mb-3" />
            <h3 className="text-lg font-semibold text-slate-800">No Journal Entries Found</h3>
            <p className="text-sm text-slate-500 max-w-sm mt-1">
              Start setting your goals, checking off habits, and saving logs to populate your daily dashboard trends.
            </p>
            <div className="mt-6">
              <button
                onClick={onClose}
                className="inline-flex items-center gap-2 bg-[#1e3a8a] hover:bg-blue-800 text-white font-medium text-sm py-2 px-5 rounded-xl transition-colors cursor-pointer"
              >
                Go to Today's Page <ArrowRight size={16} />
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 md:p-8 space-y-8">
            {/* KPI Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
                <span className="text-xs font-semibold text-slate-400 tracking-wider font-mono">DAYS TRACKED</span>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-3xl font-extrabold text-[#1e3a8a]">{totalDays}</span>
                  <span className="text-xs text-slate-400">entries saved</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
                  <Calendar size={12} className="text-blue-500" />
                  <span>First entry: {entryKeys[0]}</span>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
                <span className="text-xs font-semibold text-slate-400 tracking-wider font-mono">CURRENT STREAK</span>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-3xl font-extrabold text-orange-600">{streak.current}</span>
                  <span className="text-xs text-slate-400">days running</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
                  <TrendingUp size={12} className="text-orange-500" />
                  <span>Longest streak: {streak.longest} days</span>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
                <span className="text-xs font-semibold text-slate-400 tracking-wider font-mono">HABIT LEVEL</span>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-3xl font-extrabold text-blue-900">{avgHabits}%</span>
                  <span className="text-xs text-slate-400">average daily</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
                  <Award size={12} className="text-blue-600" />
                  <span>Top: "{topHabit?.name.slice(0, 20)}..."</span>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
                <span className="text-xs font-semibold text-slate-400 tracking-wider font-mono font-sans">MIND & SPIRIT</span>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-3xl font-extrabold text-emerald-600">{avgSpirit}%</span>
                  <span className="text-xs text-slate-400">average daily</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
                  <Heart size={12} className="text-emerald-500" />
                  <span>Top: "{topSpirit?.name.slice(0, 20)}..."</span>
                </div>
              </div>
            </div>

            {/* Core Analytics Sections */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Habits Breakdown */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2 border-b border-slate-100 pb-2">
                  <CheckCircle size={16} className="text-indigo-600" />
                  HABITS COMPLETION RANK
                </h3>
                <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
                  {habitCompletionCounts.map((habit, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-slate-700 truncate max-w-xs">{habit.name}</span>
                        <span className="text-slate-500 font-mono font-semibold">{habit.percentage}% ({habit.count}d)</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-[#1e3a8a] h-full rounded-full transition-all"
                          style={{ width: `${habit.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mind & Spirit Breakdown */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2 border-b border-slate-100 pb-2">
                  <Heart size={16} className="text-emerald-600" />
                  HEALTHY MIND & SPIRIT RANK
                </h3>
                <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
                  {spiritCompletionCounts.map((item, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-slate-700 truncate max-w-xs">{item.name}</span>
                        <span className="text-emerald-600 font-mono font-semibold">{item.percentage}% ({item.count}d)</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-600 h-full rounded-full transition-all"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Today I Made Time For Activity Graph & Meditation Streak */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Made Time */}
              <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2 border-b border-slate-100 pb-2">
                  <Award size={16} className="text-indigo-600" />
                  ALLOCATED TIME COMPARISON ("TODAY I MADE TIME FOR")
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {madeTimeStats.map((item) => (
                    <div key={item.key} className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1">
                      <div className="flex justify-between text-[11px] font-bold text-slate-600">
                        <span>{item.label}</span>
                        <span>{item.percentage}%</span>
                      </div>
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-blue-600 h-full rounded-full"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Meditation Widget and Backups */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div className="space-y-4">
                  <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2 border-b border-slate-100 pb-2">
                    <SparklesIcon size={16} className="text-indigo-600" />
                    MEDITATION LOOP
                  </h3>
                  <div className="text-center p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/60 flex flex-col items-center">
                    <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">CHALLENGE RATIO</span>
                    <span className="text-4xl font-extrabold text-[#1e3a8a] my-2">{meditationPercentage}%</span>
                    <span className="text-[11px] text-slate-600 font-medium">
                      Completed 1-minute meditation challenge {meditationTotal} out of {totalDays} days tracked!
                    </span>
                  </div>
                </div>

                <div className="space-y-3 mt-4 border-t border-slate-100 pt-4">
                  <span className="text-xs font-semibold text-slate-500 block">EXPORT & IMPORT DATA</span>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={exportData}
                      className="w-full text-xs font-bold py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-900 text-white transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      id="export-backup-btn"
                    >
                      <Download size={14} /> Download JSON Backup
                    </button>
                    <label className="w-full text-xs font-bold py-2 px-3 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 transition-colors flex items-center justify-center gap-1.5 cursor-pointer text-center">
                      <Upload size={14} /> Import Backup File
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleImport}
                        className="hidden"
                        id="import-backup-file"
                      />
                    </label>
                  </div>
                  {importError && (
                    <p className={`text-[10px] text-center font-semibold ${importError.includes("successful") ? "text-green-600" : "text-rose-600"}`}>
                      {importError}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Past Logs History Table */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-2 flex items-center justify-between">
                <span>PREVIOUS LOGS AND DAY HISTORY</span>
                <span className="text-xs font-mono font-medium text-slate-400">{totalDays} entry saved</span>
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 font-mono tracking-wider uppercase">
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Challenge of the Day</th>
                      <th className="py-2.5 px-3 text-center">Habits Score</th>
                      <th className="py-2.5 px-3 text-center">Mind & Spirit</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {entryKeys.slice().reverse().map(date => {
                      const entry = entries[date];
                      const totalH = Object.values(entry.habits).filter(Boolean).length;
                      const totalS = Object.values(entry.spirit).filter(Boolean).length;
                      const hPct = Math.round((totalH / SUCCESS_HABITS.length) * 100);
                      const sPct = Math.round((totalS / HEALTHY_MIND_SPIRIT.length) * 100);

                      return (
                        <tr key={date} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-3 font-mono text-xs font-bold text-indigo-950">{date}</td>
                          <td className="py-3 px-3 text-xs max-w-xs truncate text-slate-600">
                            {entry.challenge || <span className="text-slate-300 italic">None logged</span>}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="inline-block font-mono text-xs bg-indigo-50 font-bold text-[#1e3a8a] px-2 py-0.5 rounded-md">
                              {totalH} / {SUCCESS_HABITS.length} ({hPct}%)
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="inline-block font-mono text-xs bg-emerald-50 font-bold text-emerald-700 px-2 py-0.5 rounded-md">
                              {totalS} / {HEALTHY_MIND_SPIRIT.length} ({sPct}%)
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={() => {
                                onSelectDate(date);
                                onClose();
                              }}
                              className="inline-flex items-center gap-1 text-xs font-bold text-[#1e3a8a] hover:text-blue-900 border border-slate-200 hover:border-[#1e3a8a]/40 bg-white py-1 px-2.5 rounded-lg transition-all cursor-pointer"
                            >
                              Open <ArrowRight size={12} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Footer Area */}
        <div className="bg-slate-100 border-t border-slate-200/90 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-xs text-slate-400 font-medium">Click on any past log row to warp to that planner page.</span>
          <button
            onClick={onClose}
            className="w-full sm:w-auto bg-[#1e3a8a] text-white hover:bg-indigo-900 text-xs font-bold py-2.5 px-6 rounded-xl transition-colors cursor-pointer"
            id="close-analytics-bottom"
          >
            Go Back to Daily Success Planner
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// Simple internal sparkless inline helper icon
function SparklesIcon({ size = 16, className = "" }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275Z" />
      <path d="m5 3 1 2.5L8.5 6 6 7 5 9.5 4 7 1.5 6 4 5.5Z" />
      <path d="m19 17 1 2.5 2.5.5-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1Z" />
    </svg>
  );
}
