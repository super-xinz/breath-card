import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const SESSION_MS = 60_000;
const INHALE_MS = 4_000;
const EXHALE_MS = 6_000;

const phaseDuration = {
  inhale: INHALE_MS,
  exhale: EXHALE_MS
};

const phaseLabel = {
  inhale: "Inhale",
  exhale: "Exhale"
};

function easeInOutSine(value) {
  return -(Math.cos(Math.PI * value) - 1) / 2;
}

function formatTime(milliseconds) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function useHapticController() {
  const timersRef = useRef({
    interval: null,
    timeouts: []
  });
  const [fallbackPulse, setFallbackPulse] = useState(false);

  const canVibrate = useCallback(() => {
    return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
  }, []);

  const stopHaptics = useCallback(() => {
    if (timersRef.current.interval) {
      window.clearInterval(timersRef.current.interval);
    }

    timersRef.current.timeouts.forEach((timerId) => window.clearTimeout(timerId));
    timersRef.current = { interval: null, timeouts: [] };
    setFallbackPulse(false);

    if (canVibrate()) {
      navigator.vibrate(0);
    }
  }, [canVibrate]);

  const startHaptics = useCallback(
    (phase) => {
      stopHaptics();

      if (!canVibrate()) {
        setFallbackPulse(true);
        return;
      }

      const pulse = (duration) => {
        navigator.vibrate(duration);
      };

      if (phase === "inhale") {
        pulse(64);
        timersRef.current.interval = window.setInterval(() => pulse(54), 390);
        timersRef.current.timeouts.push(window.setTimeout(stopHaptics, INHALE_MS));
        return;
      }

      const exhalePattern = [
        [0, 60],
        [680, 55],
        [1500, 50],
        [2460, 46],
        [3560, 42],
        [4880, 38]
      ];

      timersRef.current.timeouts = exhalePattern.map(([delay, duration]) => {
        return window.setTimeout(() => pulse(duration), delay);
      });
      timersRef.current.timeouts.push(window.setTimeout(stopHaptics, EXHALE_MS));
    },
    [canVibrate, stopHaptics]
  );

  const cleanupHaptics = useCallback(() => {
    stopHaptics();
  }, [stopHaptics]);

  return {
    fallbackPulse,
    startHaptics,
    stopHaptics,
    cleanupHaptics
  };
}

function PetalFlower({ phaseView, fallbackPulse }) {
  const petalCount = 8;
  const progress = easeInOutSine(phaseView.progress);
  const breath =
    phaseView.phase === "inhale"
      ? progress
      : phaseView.phase === "exhale"
        ? 1 - progress
        : 0;

  const scale = 0.95 + breath * 0.44;
  const glow = 0.34 + breath * 0.36;
  const haloSize = 124 + breath * 54;
  const haloOpacity = 0.14 + breath * 0.18;

  const petals = useMemo(() => Array.from({ length: petalCount }), []);

  return (
    <div className="relative mx-auto my-8 flex h-48 w-48 items-center justify-center">
      <div
        className={`absolute rounded-full bg-cyan-300/20 blur-3xl transition-opacity duration-700 ${
          fallbackPulse ? "animate-soft-pulse" : ""
        }`}
        style={{
          width: `${haloSize}px`,
          height: `${haloSize}px`,
          opacity: haloOpacity
        }}
      />

      <div
        className="relative h-36 w-36"
        style={{
          transform: `scale(${scale})`,
          filter: `drop-shadow(0 0 ${18 + breath * 18}px rgba(103, 232, 249, ${glow}))`,
          transition:
            phaseView.phase === "ready" || phaseView.phase === "done"
              ? "transform 1200ms ease, filter 1200ms ease"
              : "none"
        }}
      >
        {petals.map((_, index) => {
          const angle = (360 / petalCount) * index;
          const distance = 16 + breath * 24;
          const opacity = 0.42 + breath * 0.28;
          const length = 0.92 + breath * 0.13;

          return (
            <div
              key={angle}
              className="absolute left-1/2 top-1/2 h-24 w-11 rounded-full bg-[linear-gradient(180deg,rgba(125,211,252,0.72),rgba(129,140,248,0.5)_52%,rgba(196,181,253,0.4))] shadow-petal"
              style={{
                opacity,
                transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-${distance}px) scaleY(${length})`,
                transition: phaseView.phase === "ready" || phaseView.phase === "done" ? "all 1100ms ease" : "none",
                transitionDelay: `${index * 22}ms`
              }}
            />
          );
        })}

        <div
          className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-100/80 blur-sm"
          style={{ opacity: 0.32 + breath * 0.3 }}
        />
        <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/80" />
      </div>
    </div>
  );
}

function App() {
  const [isRunning, setIsRunning] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [status, setStatus] = useState("Ready");
  const [timeLeft, setTimeLeft] = useState(SESSION_MS);
  const [phaseView, setPhaseView] = useState({
    phase: "ready",
    progress: 0
  });

  const rafRef = useRef(null);
  const isRunningRef = useRef(false);
  const phaseRef = useRef("inhale");
  const phaseStartAtRef = useRef(0);
  const phaseElapsedOnPauseRef = useRef(0);
  const runStartedAtRef = useRef(0);
  const remainingAtRunStartRef = useRef(SESSION_MS);

  const { fallbackPulse, startHaptics, stopHaptics, cleanupHaptics } = useHapticController();

  const stopAnimationFrame = useCallback(() => {
    if (rafRef.current) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const finishSession = useCallback(() => {
    stopAnimationFrame();
    stopHaptics();
    isRunningRef.current = false;
    remainingAtRunStartRef.current = 0;
    phaseElapsedOnPauseRef.current = 0;
    setIsRunning(false);
    setIsDone(true);
    setStatus("Done");
    setTimeLeft(0);
    setPhaseView({ phase: "done", progress: 0 });
  }, [stopAnimationFrame, stopHaptics]);

  const tick = useCallback(
    (now) => {
      if (!isRunningRef.current) {
        return;
      }

      const remaining = remainingAtRunStartRef.current - (now - runStartedAtRef.current);

      if (remaining <= 0) {
        finishSession();
        return;
      }

      let activePhase = phaseRef.current;
      let elapsedInPhase = now - phaseStartAtRef.current;
      let duration = phaseDuration[activePhase];

      while (elapsedInPhase >= duration) {
        elapsedInPhase -= duration;
        activePhase = activePhase === "inhale" ? "exhale" : "inhale";
        phaseRef.current = activePhase;
        phaseStartAtRef.current = now - elapsedInPhase;
        duration = phaseDuration[activePhase];
        setStatus(phaseLabel[activePhase]);
        startHaptics(activePhase);
      }

      phaseElapsedOnPauseRef.current = elapsedInPhase;
      setTimeLeft(remaining);
      setPhaseView({
        phase: activePhase,
        progress: elapsedInPhase / duration
      });

      rafRef.current = window.requestAnimationFrame(tick);
    },
    [finishSession, startHaptics]
  );

  const startSession = useCallback(() => {
    if (isDone) {
      return;
    }

    stopAnimationFrame();
    const now = performance.now();
    const activePhase = phaseRef.current;

    isRunningRef.current = true;
    runStartedAtRef.current = now;
    phaseStartAtRef.current = now - phaseElapsedOnPauseRef.current;

    setIsRunning(true);
    setStatus(phaseLabel[activePhase]);
    startHaptics(activePhase);
    rafRef.current = window.requestAnimationFrame(tick);
  }, [isDone, startHaptics, stopAnimationFrame, tick]);

  const pauseSession = useCallback(() => {
    if (!isRunningRef.current) {
      return;
    }

    const now = performance.now();
    remainingAtRunStartRef.current = Math.max(
      0,
      remainingAtRunStartRef.current - (now - runStartedAtRef.current)
    );
    phaseElapsedOnPauseRef.current = now - phaseStartAtRef.current;

    stopAnimationFrame();
    stopHaptics();
    isRunningRef.current = false;
    setIsRunning(false);
    setStatus("Paused");
  }, [stopAnimationFrame, stopHaptics]);

  const resetSession = useCallback(() => {
    stopAnimationFrame();
    stopHaptics();
    isRunningRef.current = false;
    phaseRef.current = "inhale";
    phaseElapsedOnPauseRef.current = 0;
    remainingAtRunStartRef.current = SESSION_MS;
    setIsRunning(false);
    setIsDone(false);
    setStatus("Ready");
    setTimeLeft(SESSION_MS);
    setPhaseView({ phase: "ready", progress: 0 });
  }, [stopAnimationFrame, stopHaptics]);

  const handlePrimaryAction = () => {
    if (isDone) {
      resetSession();
      return;
    }

    if (isRunning) {
      pauseSession();
      return;
    }

    startSession();
  };

  useEffect(() => {
    return () => {
      stopAnimationFrame();
      cleanupHaptics();
    };
  }, [cleanupHaptics, stopAnimationFrame]);

  return (
    <main className="min-h-screen bg-[#070A0F] bg-[radial-gradient(circle_at_50%_18%,rgba(56,189,248,0.13),transparent_34%),radial-gradient(circle_at_50%_90%,rgba(139,92,246,0.10),transparent_35%)] px-5 py-10 text-white">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-[360px] items-center justify-center">
        <div className="w-full rounded-[2rem] border border-white/[0.12] bg-white/[0.065] px-7 py-8 text-center shadow-glass backdrop-blur-2xl">
          <h1 className="text-[1.55rem] font-medium leading-none tracking-normal text-white">Breathe</h1>
          <p className="mt-2 text-sm font-light tracking-normal text-slate-400">Follow the petals.</p>

          <PetalFlower phaseView={phaseView} fallbackPulse={fallbackPulse} />

          <div className="min-h-12">
            <p className="text-sm font-medium tracking-normal text-slate-100">{status}</p>
            <p className="mt-2 font-mono text-3xl font-light leading-none tracking-normal text-white/95">
              {formatTime(timeLeft)}
            </p>
            <p className="mt-3 h-4 text-xs font-light tracking-normal text-cyan-100/55">
              {isDone ? "Well done." : ""}
            </p>
          </div>

          <button
            type="button"
            onClick={handlePrimaryAction}
            className="mt-7 w-full rounded-full border border-white/[0.14] bg-white/[0.075] px-6 py-3 text-sm font-medium text-white/[0.92] shadow-inner shadow-white/5 transition duration-200 hover:bg-white/[0.11] active:scale-[0.985]"
          >
            {isDone ? "Again" : isRunning ? "Pause" : "Start"}
          </button>

          <p className="mt-5 text-[0.68rem] font-light tracking-normal text-slate-500">
            gentle haptic rhythm
          </p>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
