import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Play, Square, Volume2, VolumeX, X, Trophy } from "lucide-react";

interface MeditationTimerProps {
  onComplete: () => void;
  onClose: () => void;
}

export default function MeditationTimer({ onComplete, onClose }: MeditationTimerProps) {
  const [isActive, setIsActive] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const [phase, setPhase] = useState<"Inhale" | "Hold" | "Exhale" | "Rest">("Inhale");
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Sound generator using Web Audio API to prevent needing external asset files
  const playSound = (freq: number, duration: number) => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.frequency.value = freq;
      gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + duration);
    } catch (e) {
      console.warn("AudioContext failed or blocked by autoplay rule:", e);
    }
  };

  // Run the 1-minute timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isActive && secondsLeft > 0) {
      interval = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            setIsActive(false);
            onComplete();
            playSound(587.33, 1.5); // D5 chime for celebration!
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (interval) clearInterval(interval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, secondsLeft]);

  // Manage custom box breathing cycle (4 seconds for each phase)
  useEffect(() => {
    let breathInterval: NodeJS.Timeout | null = null;
    if (isActive) {
      // Phase cycle
      breathInterval = setInterval(() => {
        setPhase((prev) => {
          if (prev === "Inhale") {
            playSound(329.63, 0.4); // E4 soft beep
            return "Hold";
          }
          if (prev === "Hold") {
            playSound(392.00, 0.4); // G4 soft beep
            return "Exhale";
          }
          if (prev === "Exhale") {
            playSound(329.63, 0.4); // E4 soft beep
            return "Rest";
          }
          playSound(261.63, 0.4); // C4 soft beep
          return "Inhale";
        });
      }, 4000);
    }
    return () => {
      if (breathInterval) clearInterval(breathInterval);
    };
  }, [isActive]);

  const toggleTimer = () => {
    if (isActive) {
      setIsActive(false);
    } else {
      if (secondsLeft === 0) {
        setSecondsLeft(60);
      }
      setIsActive(true);
      playSound(523.25, 1.0); // C5 start chime
    }
  };

  const getPhaseInstruction = () => {
    switch (phase) {
      case "Inhale":
        return "Breathe In Deeply...";
      case "Hold":
        return "Hold Your Breath...";
      case "Exhale":
        return "Slowly Breathe Out...";
      case "Rest":
        return "Pause and Quiet Your Mind...";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 flex flex-col items-center justify-between min-h-[480px] relative overflow-hidden"
      >
        {/* Subtle Ambient Background Glow linked to breath scale */}
        <div className="absolute inset-0 bg-gradient-to-b from-blue-50/20 to-indigo-50/20 pointer-events-none" />

        <div className="w-full flex justify-between items-center z-10">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2.5 rounded-full hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-800"
            title={soundEnabled ? "Mute chimes" : "Enable chimes"}
            id="meditation-sound-toggle"
          >
            {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
          <span className="text-sm font-semibold tracking-wide text-slate-400 font-mono">
            1-MIN MINDFULNESS
          </span>
          <button
            onClick={onClose}
            className="p-2.5 rounded-full hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-800"
            id="meditation-close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Breathing Circle Visualization */}
        <div className="relative flex items-center justify-center w-60 h-60 my-6 z-10">
          <AnimatePresence>
            {isActive && (
              <motion.div
                animate={{
                  scale: phase === "Inhale" ? [1, 1.4] : phase === "Hold" ? 1.4 : phase === "Exhale" ? [1.4, 1] : 1,
                  backgroundColor: phase === "Inhale" ? "rgba(191,219,254,0.5)" : phase === "Hold" ? "rgba(147,197,253,0.6)" : "rgba(191,219,254,0.3)",
                }}
                transition={{
                  duration: 4,
                  ease: "easeInOut",
                  repeat: 0,
                }}
                className="absolute w-36 h-36 rounded-full"
                key={phase}
              />
            )}
          </AnimatePresence>

          {/* Core static circle showing indicator text */}
          <div className="absolute w-32 h-32 rounded-full bg-[#1e3a8a] text-white flex flex-col justify-center items-center shadow-lg border-2 border-white/20">
            {secondsLeft === 0 ? (
              <div className="text-center p-2 flex flex-col items-center">
                <Trophy size={32} className="text-yellow-300 mb-1" />
                <span className="text-xs font-bold font-sans tracking-wide">COMPLETED</span>
              </div>
            ) : (
              <div className="text-center">
                <span className="text-4xl font-extrabold font-mono tracking-tighter">
                  {secondsLeft}s
                </span>
                <p className="text-[10px] tracking-widest text-blue-200 mt-1 uppercase">
                  {isActive ? phase : "Ready"}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="text-center space-y-2 z-10 px-4 min-h-[56px] flex flex-col justify-center">
          {secondsLeft === 0 ? (
            <div>
              <p className="text-base font-semibold text-slate-900">
                You Completed the Challenge!
              </p>
              <p className="text-xs text-slate-500">
                A great habit built for a peaceful mind.
              </p>
            </div>
          ) : (
            <div>
              <p className="text-base font-medium text-slate-800 min-h-[24px]">
                {isActive ? getPhaseInstruction() : "Take one minute for self-awareness."}
              </p>
              <p className="text-xs text-slate-400">
                {isActive ? "Follow the circular swell and chimes" : "Press start to begin box breathing"}
              </p>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="mt-6 w-full flex flex-col gap-2 z-10">
          {secondsLeft > 0 ? (
            <button
              onClick={toggleTimer}
              className={`w-full py-3.5 px-6 rounded-2xl font-bold tracking-wide transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer ${
                isActive
                  ? "bg-slate-800 hover:bg-slate-900 text-white"
                  : "bg-[#1e3a8a] hover:bg-[#1a3073] text-white shadow-md shadow-blue-900/10"
              }`}
              id="meditation-start-btn"
            >
              {isActive ? (
                <>
                  <Square size={18} fill="currentColor" /> Pause Challenge
                </>
              ) : (
                <>
                  <Play size={18} fill="currentColor" /> Start 1-Min Breath
                </>
              )}
            </button>
          ) : (
            <button
              onClick={() => {
                onComplete();
                onClose();
              }}
              className="w-full py-3.5 px-6 rounded-2xl font-bold tracking-wide bg-green-600 hover:bg-green-700 text-white shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              id="meditation-done-btn"
            >
              Apply to Today's Checklist
            </button>
          )}

          <button
            onClick={() => {
              setSecondsLeft(60);
              setIsActive(false);
            }}
            disabled={secondsLeft === 60}
            className="w-full py-2 text-xs font-semibold text-slate-400 hover:text-slate-600 disabled:opacity-40 transition-colors"
            id="meditation-reset-btn"
          >
            Reset Time
          </button>
        </div>
      </motion.div>
    </div>
  );
}
