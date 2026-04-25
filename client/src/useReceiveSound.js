import { useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'monopoly-sound';

function readEnabled() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw == null ? true : raw === 'on';
}

let sharedCtx = null;
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
  // Üç nota tatlı bir akor: C5, E5, G5
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
  const unlocked = useRef(false);

  // İlk kullanıcı etkileşiminde audio context'i ayağa kaldır (autoplay kısıtlaması)
  // iOS Safari için: gerçekten sessiz bir buffer çal ki context "warm" olsun.
  useEffect(() => {
    const unlock = () => {
      if (unlocked.current) return;
      const ctx = getCtx();
      if (!ctx) return;
      try {
        // Boş 1 sample'lık buffer çal — iOS'ta context'i tam aktive eder
        const buffer = ctx.createBuffer(1, 1, 22050);
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.connect(ctx.destination);
        src.start(0);
        // resume() de mutlaka kullanıcı gesture'ından çağrılmalı
        if (ctx.state === 'suspended') ctx.resume();
        unlocked.current = true;
      } catch (e) {
        // ignore
      }
    };
    document.addEventListener('click', unlock);
    document.addEventListener('touchend', unlock);
    return () => {
      document.removeEventListener('click', unlock);
      document.removeEventListener('touchend', unlock);
    };
  }, []);

  // Sayfa görünür olduğunda context'i resume et (iOS arka plan/ön plan döngüsü)
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
      const ctx = getCtx();
      if (ctx && unlocked.current) {
        try { playKaching(ctx); } catch (e) { /* ignore */ }
      }
      navigator.vibrate?.([80, 40, 80]);
    }
    prev.current = balance;
  }, [balance, enabled]);
}
