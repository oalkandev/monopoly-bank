import { useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'monopoly-sound';
const SOUND_URL = '/cash.mp3';

function readEnabled() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw == null ? true : raw === 'on';
}

let sharedAudio = null;
let unlocked = false;

function getAudio() {
  if (!sharedAudio) {
    sharedAudio = new Audio(SOUND_URL);
    sharedAudio.preload = 'auto';
    sharedAudio.volume = 0.7;
  }
  return sharedAudio;
}

function playCashSound() {
  const a = getAudio();
  // Yeni bir clone ile çal — üst üste sesler için
  try {
    const clone = a.cloneNode(true);
    clone.volume = a.volume;
    const p = clone.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch (e) {
    try {
      a.currentTime = 0;
      a.play().catch(() => {});
    } catch (_) { /* ignore */ }
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

  // İlk kullanıcı etkileşiminde audio'yu unlock et (iOS/autoplay)
  useEffect(() => {
    const unlock = () => {
      if (unlocked) return;
      const a = getAudio();
      // Sessize alıp bir kez başlatıp durdur — iOS Safari için unlock pattern'i
      const originalVolume = a.volume;
      a.volume = 0;
      const p = a.play();
      if (p && typeof p.then === 'function') {
        p.then(() => {
          a.pause();
          a.currentTime = 0;
          a.volume = originalVolume;
          unlocked = true;
        }).catch(() => {
          a.volume = originalVolume;
        });
      } else {
        unlocked = true;
        a.pause();
        a.volume = originalVolume;
      }
    };
    document.addEventListener('click', unlock);
    document.addEventListener('touchend', unlock);
    return () => {
      document.removeEventListener('click', unlock);
      document.removeEventListener('touchend', unlock);
    };
  }, []);

  useEffect(() => {
    if (typeof balance !== 'number') return;
    if (balance > prev.current && enabled) {
      playCashSound();
      navigator.vibrate?.([80, 40, 80]);
    }
    prev.current = balance;
  }, [balance, enabled]);
}
