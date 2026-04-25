import { useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'monopoly-sound';
const SOUND_URL = '/cash.mp3';
const POOL_SIZE = 4;

function readEnabled() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw == null ? true : raw === 'on';
}

let pool = null;
let poolIdx = 0;
let unlocked = false;

function buildPool() {
  if (pool) return pool;
  pool = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    const a = new Audio(SOUND_URL);
    a.preload = 'auto';
    a.volume = 0.7;
    a.load();
    pool.push(a);
  }
  return pool;
}

// iOS: tek bir kullanıcı gesture'ı içinde TÜM havuzu unlock et.
// Synchronous play() çağrıları aynı gesture context'inde sayılır.
function unlockPool() {
  if (unlocked) return;
  const items = buildPool();
  let pending = items.length;
  let succeeded = 0;
  for (const a of items) {
    const orig = a.volume;
    a.volume = 0;
    const p = a.play();
    const settle = (ok) => {
      a.pause();
      try { a.currentTime = 0; } catch {}
      a.volume = orig;
      if (ok) succeeded++;
      pending--;
      if (pending === 0 && succeeded > 0) unlocked = true;
    };
    if (p && typeof p.then === 'function') {
      p.then(() => settle(true)).catch(() => settle(false));
    } else {
      settle(true);
    }
  }
}

function play() {
  if (!pool || pool.length === 0) return;
  const a = pool[poolIdx];
  poolIdx = (poolIdx + 1) % pool.length;
  try {
    a.pause();
    a.currentTime = 0;
    const p = a.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch (e) {
    // ignore
  }
}

export function useSoundSetting() {
  const [enabled, setEnabled] = useState(readEnabled);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
  }, [enabled]);

  return { enabled, toggle: () => setEnabled(v => !v) };
}

export function useReceiveSound(balance, enabled = true) {
  const prev = useRef(balance);

  // İlk kullanıcı dokunuşunda havuzu unlock et
  useEffect(() => {
    const onGesture = () => unlockPool();
    document.addEventListener('click', onGesture, { passive: true });
    document.addEventListener('touchend', onGesture, { passive: true });
    return () => {
      document.removeEventListener('click', onGesture);
      document.removeEventListener('touchend', onGesture);
    };
  }, []);

  // Sayfa background'dan dönünce iOS bazen Audio element'lerini "unloaded" eder
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible' && pool) {
        for (const a of pool) {
          try { a.load(); } catch {}
        }
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    if (typeof balance !== 'number') return;
    if (balance > prev.current && enabled) {
      play();
      navigator.vibrate?.([80, 40, 80]);
    }
    prev.current = balance;
  }, [balance, enabled]);
}
