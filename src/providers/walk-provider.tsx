import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Pedometer } from 'expo-sensors';
import { createContext, use, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';

import { creditSteps, shareLocation, stopSharingLocation } from '@/lib/walk';
import { StepCounter, type StepCounterReading } from '../../modules/step-counter';
import { useSession } from '@/providers/session-provider';

type Status = 'checking' | 'unavailable' | 'denied' | 'ready';
export type Position = { lat: number; lng: number };

type WalkContextValue = {
  pedometer: Status;
  /** Steps counted today on this device, including ones not yet paid out. */
  todaySteps: number;
  location: Status;
  position: Position | null;
  requestLocation: () => Promise<void>;
  /** Whether other players can see this player on the map. */
  sharing: boolean;
  setSharing: (on: boolean) => void;
  /** Count only steps taken while the app is open, ignoring ones walked while it was closed. */
  foregroundOnly: boolean;
  setForegroundOnly: (on: boolean) => void;
};

/** Pending steps are paid out once this many pile up, after this long, or when the app goes to the background. */
const FLUSH_STEPS = 50;
const FLUSH_INTERVAL_MS = 20_000;
/** How often the step count is re-read while the app is open. */
const SYNC_INTERVAL_MS = 10_000;
/** Minimum time between location writes while moving. */
const SHARE_INTERVAL_MS = 30_000;
const SHARING_KEY = 'walk:sharing';
const FOREGROUND_ONLY_KEY = 'walk:foregroundOnly';

const WalkContext = createContext<WalkContextValue | null>(null);

function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

export function WalkProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useSession();
  const uid = user?.uid;
  const [pedometer, setPedometer] = useState<Status>(Platform.OS === 'web' ? 'unavailable' : 'checking');
  const [todaySteps, setTodaySteps] = useState(0);
  // Browsers can't report a permission without prompting, so web starts out asking.
  const [location, setLocation] = useState<Status>(Platform.OS === 'web' ? 'denied' : 'checking');
  const [position, setPosition] = useState<Position | null>(null);
  const [sharing, setSharingState] = useState(true);
  /** Null until the saved choice is read, so counting doesn't start in the wrong mode. */
  const [foregroundOnly, setForegroundOnlyState] = useState<boolean | null>(null);
  const lastShare = useRef<{ at: number; avatar: string | null; nickname: string | undefined } | null>(null);

  // Steps, including ones walked while the app was closed:
  // - ios: today's total from Core Motion, minus what was already paid today.
  // - counter (Android build with modules/step-counter): the hardware counter since boot, minus the reading
  //   at the last payout.
  // - watch (Expo Go on Android, or the foreground-only setting): only steps reported while the app is open.
  useEffect(() => {
    if (!uid || Platform.OS === 'web' || foregroundOnly === null) return;
    const mode = foregroundOnly
      ? 'watch'
      : Platform.OS === 'ios'
        ? 'ios'
        : StepCounter?.isAvailable()
          ? 'counter'
          : 'watch';
    const dayStorageKey = (day: string) => `walk:${uid}:${day}`;
    const counterStorageKey = `walk:${uid}:counter`;
    // Set when foreground-only is turned off: steps walked while it was on must not be paid afterwards.
    const rebaseStorageKey = `walk:${uid}:rebase`;
    let rebase = false;
    const state = {
      day: dayKey(),
      credited: 0,
      pending: 0,
      flushing: false,
      lastFlush: Date.now(),
      watched: 0,
      baseline: null as StepCounterReading | null,
      reading: null as StepCounterReading | null,
    };
    let cancelled = false;
    let subscription: { remove: () => void } | undefined;

    const show = () => {
      if (!cancelled) setTodaySteps(state.credited + state.pending);
    };
    const rollDay = () => {
      if (state.day === dayKey()) return;
      state.day = dayKey();
      state.credited = 0;
    };
    const flush = async (force: boolean) => {
      if (state.flushing || state.pending <= 0) return;
      if (!force && state.pending < FLUSH_STEPS && Date.now() - state.lastFlush < FLUSH_INTERVAL_MS) return;
      const steps = state.pending;
      const reading = state.reading;
      state.flushing = true;
      try {
        await creditSteps(uid, steps);
        state.lastFlush = Date.now();
        state.pending -= steps;
        state.credited += steps;
        if (mode === 'counter' && reading) {
          state.baseline = reading;
          await AsyncStorage.setItem(counterStorageKey, JSON.stringify(reading));
        }
        await AsyncStorage.setItem(dayStorageKey(state.day), String(state.credited));
      } catch {
        // Kept pending; the next flush retries.
      } finally {
        state.flushing = false;
        show();
      }
    };
    const sync = async () => {
      if (state.flushing || mode === 'watch') return;
      rollDay();
      if (mode === 'ios') {
        const { steps } = await Pedometer.getStepCountAsync(startOfToday(), new Date());
        if (rebase) {
          rebase = false;
          state.credited = Math.max(state.credited, steps);
          await AsyncStorage.setItem(dayStorageKey(state.day), String(state.credited));
          await AsyncStorage.removeItem(rebaseStorageKey);
        }
        state.pending = Math.max(0, steps - state.credited);
      } else {
        const reading = await StepCounter?.readAsync();
        if (!reading) return;
        state.reading = reading;
        const base = rebase ? null : state.baseline;
        if (rebase) {
          rebase = false;
          await AsyncStorage.removeItem(rebaseStorageKey);
        }
        if (!base) {
          // First reading on this device: start counting from now.
          state.baseline = reading;
          await AsyncStorage.setItem(counterStorageKey, JSON.stringify(reading));
          return;
        }
        const rebooted = reading.bootCount !== base.bootCount || reading.steps < base.steps;
        state.pending = Math.floor(rebooted ? reading.steps : reading.steps - base.steps);
      }
      show();
      await flush(false);
    };

    (async () => {
      if (!(await Pedometer.isAvailableAsync())) return setPedometer('unavailable');
      if (!(await Pedometer.requestPermissionsAsync()).granted) return setPedometer('denied');
      state.credited = Number(await AsyncStorage.getItem(dayStorageKey(state.day))) || 0;
      const saved = await AsyncStorage.getItem(counterStorageKey);
      state.baseline = saved ? (JSON.parse(saved) as StepCounterReading) : null;
      rebase = mode !== 'watch' && (await AsyncStorage.getItem(rebaseStorageKey)) === '1';
      if (cancelled) return;
      setPedometer('ready');
      show();
      if (mode === 'watch') {
        subscription = Pedometer.watchStepCount(({ steps }) => {
          const delta = steps - state.watched;
          state.watched = steps;
          if (delta <= 0 || (foregroundOnly && AppState.currentState !== 'active')) return;
          rollDay();
          state.pending += delta;
          show();
          flush(false);
        });
      } else {
        await sync().catch(() => {});
      }
    })();

    const timer = setInterval(() => {
      if (mode === 'watch') flush(false);
      else sync().catch(() => {});
    }, SYNC_INTERVAL_MS);
    const appState = AppState.addEventListener('change', (next) => {
      if (next === 'background') flush(true);
      if (next === 'active') sync().catch(() => {});
    });

    return () => {
      cancelled = true;
      subscription?.remove();
      clearInterval(timer);
      appState.remove();
      flush(true);
    };
  }, [uid, foregroundOnly]);

  useEffect(() => {
    AsyncStorage.getItem(SHARING_KEY).then((value) => setSharingState(value !== 'off'));
    AsyncStorage.getItem(FOREGROUND_ONLY_KEY).then((value) => setForegroundOnlyState(value === 'on'));
    if (Platform.OS === 'web') return;
    Location.getForegroundPermissionsAsync().then(({ granted }) => setLocation(granted ? 'ready' : 'denied'));
  }, []);

  useEffect(() => {
    if (location !== 'ready') return;
    let removed = false;
    let subscription: { remove: () => void } | undefined;
    const update = ({ coords }: Location.LocationObject) => {
      if (!removed) setPosition({ lat: coords.latitude, lng: coords.longitude });
    };
    Location.getLastKnownPositionAsync()
      .then((last) => last && update(last))
      .catch(() => {});
    Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, distanceInterval: 10, timeInterval: 10_000 },
      update,
    ).then((sub) => {
      if (removed) sub.remove();
      else subscription = sub;
    });
    return () => {
      removed = true;
      subscription?.remove();
    };
  }, [location]);

  const username = profile?.username;
  const nickname = profile?.nickname;
  const avatar = profile?.avatar ?? null;
  useEffect(() => {
    if (!uid || !username || !position || !sharing) return;
    const last = lastShare.current;
    if (last && last.avatar === avatar && last.nickname === nickname && Date.now() - last.at < SHARE_INTERVAL_MS) return;
    lastShare.current = { at: Date.now(), avatar, nickname };
    shareLocation(uid, { username, nickname }, avatar, position.lat, position.lng).catch(() => {
      lastShare.current = null;
    });
  }, [uid, username, nickname, avatar, position, sharing]);

  async function requestLocation() {
    const { granted } = await Location.requestForegroundPermissionsAsync();
    setLocation(granted ? 'ready' : 'denied');
  }

  function setSharing(on: boolean) {
    setSharingState(on);
    AsyncStorage.setItem(SHARING_KEY, on ? 'on' : 'off');
    if (!on && uid) {
      lastShare.current = null;
      stopSharingLocation(uid).catch(() => {});
    }
  }

  function setForegroundOnly(on: boolean) {
    if (!on && uid) AsyncStorage.setItem(`walk:${uid}:rebase`, '1');
    AsyncStorage.setItem(FOREGROUND_ONLY_KEY, on ? 'on' : 'off');
    setForegroundOnlyState(on);
  }

  return (
    <WalkContext
      value={{
        pedometer,
        todaySteps,
        location,
        position,
        requestLocation,
        sharing,
        setSharing,
        foregroundOnly: foregroundOnly ?? false,
        setForegroundOnly,
      }}>
      {children}
    </WalkContext>
  );
}

export function useWalk() {
  const value = use(WalkContext);
  if (!value) throw new Error('useWalk must be used inside <WalkProvider>');
  return value;
}
