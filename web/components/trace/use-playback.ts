"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type PlaybackSpeed = 0.5 | 1 | 2 | 4;

export type Playback = {
  /** Current step index, clamped to [0, length-1]. */
  index: number;
  /** Whether auto-advance is currently running. */
  playing: boolean;
  /** Steps-per-second multiplier applied to the base cadence. */
  speed: PlaybackSpeed;
  setSpeed: (speed: PlaybackSpeed) => void;
  /** Jump to an absolute step index (clamped). Pauses nothing on its own. */
  seek: (index: number) => void;
  next: () => void;
  prev: () => void;
  /** Toggle play/pause. Restarts from 0 if invoked at the final step. */
  toggle: () => void;
  play: () => void;
  pause: () => void;
  /** Reset to step 0 and pause. */
  restart: () => void;
  atStart: boolean;
  atEnd: boolean;
};

/** Base auto-advance cadence (ms per step at speed 1). */
const BASE_INTERVAL_MS = 850;

/**
 * Transport state machine for an episode of `length` steps.
 *
 * Auto-advance is driven by a self-correcting timeout (re-armed each step) so a
 * speed change takes effect immediately. Playback pauses automatically when it
 * reaches the final step. `length` changing (e.g. switching episodes) resets the
 * cursor to 0 and stops playback so we never index out of bounds.
 *
 * Reduced motion: callers pass `reduce` so the player can suppress the visual
 * auto-play flourish, but stepping itself is unaffected — the instrument must
 * still function. We keep auto-advance available either way; the *motion* is
 * gated in the components, not the logic.
 */
export function usePlayback(length: number): Playback {
  const safeLength = Math.max(0, length);
  const lastIndex = Math.max(0, safeLength - 1);

  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);

  // Reset whenever the episode length changes (episode switch / new trace).
  useEffect(() => {
    setIndex(0);
    setPlaying(false);
  }, [safeLength]);

  const clamp = useCallback(
    (i: number) => Math.min(Math.max(0, i), lastIndex),
    [lastIndex]
  );

  const seek = useCallback((i: number) => setIndex((prev) => {
    const next = Math.min(Math.max(0, i), lastIndex);
    return next === prev ? prev : next;
  }), [lastIndex]);

  const next = useCallback(() => setIndex((i) => clamp(i + 1)), [clamp]);
  const prev = useCallback(() => setIndex((i) => clamp(i - 1)), [clamp]);

  const play = useCallback(() => {
    if (safeLength <= 1) return;
    setPlaying(true);
  }, [safeLength]);
  const pause = useCallback(() => setPlaying(false), []);

  const restart = useCallback(() => {
    setIndex(0);
    setPlaying(false);
  }, []);

  const toggle = useCallback(() => {
    setPlaying((p) => {
      if (p) return false;
      if (safeLength <= 1) return false;
      // Starting from the end replays from the top.
      setIndex((i) => (i >= lastIndex ? 0 : i));
      return true;
    });
  }, [safeLength, lastIndex]);

  // Auto-advance loop: one timer, re-armed after each tick.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!playing) return;
    if (index >= lastIndex) {
      setPlaying(false);
      return;
    }
    const delay = BASE_INTERVAL_MS / speed;
    timer.current = setTimeout(() => setIndex((i) => clamp(i + 1)), delay);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [playing, index, speed, lastIndex, clamp]);

  return {
    index: clamp(index),
    playing,
    speed,
    setSpeed,
    seek,
    next,
    prev,
    toggle,
    play,
    pause,
    restart,
    atStart: index <= 0,
    atEnd: index >= lastIndex
  };
}
