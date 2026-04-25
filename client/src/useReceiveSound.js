import { useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'monopoly-sound';
const MIN_INTERVAL_MS = 800;

function readEnabled() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw == null ? true : raw === 'on';
}

let sharedCtx = null;
let unlocked = false;
let lastPlayAt = 0;

function getCtx() {
  if (!sharedCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    sharedCtx = new Ctx();
  }
  if (sharedCtx.state === 'suspended') sharedCtx.resume();
  return sharedCtx;
}

function playKaching(ctx) {
  const now = ctx.currentTime;
  // Tatlı C5 / E5 / G5 akoru, üçgen dalga, kısa decay
  const notes = [523.25, 659.25, 783.99];
  notes.forEach((freq, i) => {
    const start = now + i * 0.07;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.18, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.4);
  });
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

  // İlk kullanıcı dokunuşunda audio context unlock (iOS için sessiz buffer çal)
  useEffect(() => {
    const onGesture = () => {
      if (unlocked) return;
      const ctx = getCtx();
      if (!ctx) return;
      try {
        const buffer = ctx.createBuffer(1, 1, 22050);
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.connect(ctx.destination);
        src.start(0);
        if (ctx.state === 'suspended') ctx.resume();
        unlocked = true;
      } catch (e) {
        // ignore
      }
    };
    document.addEventListener('click', onGesture, { passive: true });
    document.addEventListener('touchend', onGesture, { passive: true });
    return () => {
      document.removeEventListener('click', onGesture);
      document.removeEventListener('touchend', onGesture);
    };
  }, []);

  // Sayfa background'dan dönünce context'i resume et
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible' && sharedCtx?.state === 'suspended') {
        sharedCtx.resume().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    if (typeof balance !== 'number') return;
    if (balance > prev.current && enabled) {
      const now = Date.now();
      if (now - lastPlayAt >= MIN_INTERVAL_MS) {
        lastPlayAt = now;
        const ctx = getCtx();
        if (ctx && unlocked) {
          try { playKaching(ctx); } catch (e) { /* ignore */ }
        }
        navigator.vibrate?.([80, 40, 80]);
      }
    }
    prev.current = balance;
  }, [balance, enabled]);
}
