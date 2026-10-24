import { useRefreshRevision } from '@/lib/app-refresh';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Pedometer } from 'expo-sensors';
import { onSnapshot } from 'firebase/firestore';
import { createContext, use, useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, AppState, PermissionsAndroid, Platform } from 'react-native';
import { initializeMapSharing, mapPreferencesRef, saveMapSharing, type MapSharing } from '@/lib/map-sharing';

import { shareLocation } from '@/lib/walk';
import { creditStepProgress, newStepEpoch, stepDeviceId } from '@/lib/step-progress';
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
  friendsOnly: boolean;
  setFriendsOnly: (on: boolean) => void;
  sharingBusy: boolean;
  sharingError: boolean;
  /** Count only steps taken while the app is open, ignoring ones walked while it was closed. */
  foregroundOnly: boolean;
  backgroundSupported: boolean;
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
const FOREGROUND_ONLY_KEY = 'walk:foregroundOnly:v2';

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
  const refreshRevision=useRefreshRevision();
  const { user, profile, loading: sessionLoading } = useSession();
  const uid = user?.uid;
  const [pedometer, setPedometer] = useState<Status>(Platform.OS === 'web' ? 'unavailable' : 'checking');
  const [todaySteps, setTodaySteps] = useState(0);
  // Query saved browser permission before asking for a new location.
  const [location, setLocation] = useState<Status>(Platform.OS === 'web' ? 'denied' : 'checking');
  const [position, setPosition] = useState<Position | null>(null);
  const freshPosition = useRef(false);
  const [mapState, setMapState] = useState<(MapSharing & { uid: string }) | null>(null);
  const [sharingBusy, setSharingBusy] = useState(false);
  const [sharingError, setSharingError] = useState(false);
  const preference = mapState?.uid === uid ? mapState : null;
  const sharing = preference?.sharing ?? false;
  const friendsOnly = preference?.audience === 'friends';
  const audience = friendsOnly ? 'friends' : 'public';
  /** Null until the saved choice is read, so counting doesn't start in the wrong mode. */
  const [foregroundOnly, setForegroundOnlyState] = useState<boolean | null>(null);
  const backgroundSupported = Platform.OS === 'ios' || (Platform.OS === 'android' && !!StepCounter?.startAsync && StepCounter.isAvailable());
  const lastCounterUid = useRef<string | null>(null);
  useEffect(() => {
    if (Platform.OS !== 'android' || sessionLoading || foregroundOnly === null) return;
    if (!uid || foregroundOnly) {
      if (!uid && lastCounterUid.current) void AsyncStorage.setItem(`walk:${lastCounterUid.current}:rebase`, '1').catch(() => {});
      void StepCounter?.stopAsync?.().catch(() => {});
    } else lastCounterUid.current = uid;
  }, [uid, sessionLoading, foregroundOnly]);
  const lastShare = useRef<{ uid: string; audience: string; at: number; avatar: string | null; nickname: string | undefined } | null>(null);
  const [shareTick, setShareTick] = useState(0);
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    const off = onSnapshot(mapPreferencesRef(uid), snapshot => {
      if (snapshot.exists()) { setMapState({ uid, ...(snapshot.data() as MapSharing) }); setSharingError(false); }
      else void AsyncStorage.getItem(SHARING_KEY).then(value => {
        if (!cancelled) return initializeMapSharing(uid, value !== 'off');
      }).catch(() => { if (!cancelled) setSharingError(true); });
    }, () => { setMapState(null); setSharingError(true); });
    return () => { cancelled = true; off(); };
  }, [uid, refreshRevision]);
  useEffect(() => {
    if (!sharing) return;
    const timer = setInterval(() => setShareTick(v => v + 1), SHARE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [sharing]);

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
        : backgroundSupported
          ? 'counter'
          : 'watch';
    const dayStorageKey = (day: string) => `walk:${uid}:${day}`;
    const counterStorageKey = `walk:${uid}:counter`;
    // Set when foreground-only is turned off: steps walked while it was on must not be paid afterwards.
    const rebaseStorageKey = `walk:${uid}:rebase`;
    let rebase = false;
    let initialized = false;
    let syncing = false;
    let deviceId = '';
    let iosLastSync = Date.now();
    const watchEpoch = `watch:${newStepEpoch()}`;
    const state = {
      day: dayKey(),
      credited: 0,
      pending: 0,
      flushing: false,
      lastFlush: Date.now(),
      watched: 0,
      foregroundTotal: 0,
      counterToday: null as number | null,
      baseline: null as StepCounterReading | null,
      reading: null as StepCounterReading | null,
    };
    let cancelled = false;
    let subscription: { remove: () => void } | undefined;

    const show = () => {
      if (!cancelled) setTodaySteps(mode === 'counter' && state.counterToday !== null ? state.counterToday : state.credited + state.pending);
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
      const flushingDay = state.day;
      const creditedBefore = state.credited;
      state.flushing = true;
      try {
        if (mode === 'counter' && reading) {
          const base = state.baseline;
          const baseline = reading.totalSteps !== undefined ? base?.totalSteps ?? 0
            : base?.bootCount === reading.bootCount && base.steps <= reading.steps ? base.steps : 0;
          const count = reading.totalSteps ?? reading.steps;
          const epoch = reading.totalSteps !== undefined ? 'ledger:1' : `boot:${reading.bootCount}`;
          await creditStepProgress(uid, `${deviceId}:counter`, epoch, Math.floor(count), Math.floor(baseline));
        } else if (mode === 'ios') {
          await creditStepProgress(uid, `${deviceId}:ios:${flushingDay}`, `ios:${flushingDay}`, creditedBefore + steps, creditedBefore);
        } else {
          await creditStepProgress(uid, `${deviceId}:watch`, watchEpoch, state.foregroundTotal);
        }
        state.lastFlush = Date.now();
        state.pending -= steps;
        if (state.day === flushingDay) state.credited += steps;
        if (mode === 'counter' && reading) {
          state.baseline = reading;
          await AsyncStorage.setItem(counterStorageKey, JSON.stringify(reading));
        }
        await AsyncStorage.setItem(dayStorageKey(flushingDay), String(creditedBefore + steps));
      } catch {
        // Kept pending; the next flush retries.
      } finally {
        state.flushing = false;
        show();
      }
    };
    const sync = async () => {
      if (!initialized || cancelled || syncing || state.flushing || mode === 'watch') return;
      syncing = true;
      try {
      rollDay();
      if (mode === 'ios') {
        // Core Motion retains up to seven days; settle closed-app days before today's count.
        if (!rebase) {
          const first = new Date(Math.max(iosLastSync, Date.now() - 6 * 86400000));
          first.setHours(0, 0, 0, 0);
          const today = startOfToday();
          for (let date = first; date < today;) {
            const next = new Date(date); next.setDate(next.getDate() + 1);
            const history = await Pedometer.getStepCountAsync(date, next);
            const day = dayKey(date);
            await creditStepProgress(uid, `${deviceId}:ios:${day}`, `ios:${day}`, Math.floor(history.steps));
            date = next;
          }
        }
        iosLastSync = Date.now();
        await AsyncStorage.setItem(`walk:${uid}:ios:lastSync`, String(iosLastSync));
        const { steps } = await Pedometer.getStepCountAsync(startOfToday(), new Date());
        if (rebase) {
          await creditStepProgress(uid, `${deviceId}:ios:${state.day}`, `ios:${state.day}`, Math.floor(steps), 0, true);
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
        state.counterToday = reading.todaySteps ?? null;
        const shouldReset = rebase;
        const base = rebase ? null : state.baseline;
        if (!base) {
          // First reading on this device: start counting from now.
          const count = reading.totalSteps ?? reading.steps;
          const epoch = reading.totalSteps !== undefined ? 'ledger:1' : `boot:${reading.bootCount}`;
          const added = await creditStepProgress(uid, `${deviceId}:counter`, epoch, Math.floor(count), Math.floor(count), shouldReset);
          state.credited += added;
          state.baseline = reading;
          if (shouldReset) { rebase = false; await AsyncStorage.removeItem(rebaseStorageKey); }
          await AsyncStorage.setItem(counterStorageKey, JSON.stringify(reading));
          show();
          return;
        }
        const rebooted = reading.bootCount !== base.bootCount || reading.steps < base.steps;
        state.pending = Math.max(0, Math.floor(reading.totalSteps !== undefined
          ? reading.totalSteps - (base.totalSteps ?? 0)
          : rebooted ? reading.steps : reading.steps - base.steps));
      }
      show();
      await flush(false);
      } finally { syncing = false; }
    };

    const startWatch = () => {
      if (!initialized || cancelled || subscription || AppState.currentState !== 'active') return;
      state.watched = 0;
      subscription = Pedometer.watchStepCount(({ steps }) => {
        const delta = steps - state.watched;
        state.watched = steps;
        if (delta <= 0 || AppState.currentState !== 'active') return;
        rollDay();
        state.foregroundTotal += delta;
        if (Platform.OS === 'android') void StepCounter?.addForegroundAsync?.(delta).catch(() => {});
        state.pending += delta;
        show();
        void flush(false);
      });
    };
    const startCounter = async () => {
      if (!initialized || mode !== 'counter' || cancelled || AppState.currentState !== 'active') return;
      if (!(await StepCounter?.startAsync?.())) throw new Error('걸음 기록 서비스를 시작하지 못했어요.');
    };
    void (async () => {
      if (!(await Pedometer.isAvailableAsync())) return setPedometer('unavailable');
      if (!(await Pedometer.requestPermissionsAsync()).granted) return setPedometer('denied');
      if (cancelled) return;
      deviceId = await stepDeviceId();
      iosLastSync = Number(await AsyncStorage.getItem(`walk:${uid}:ios:lastSync`)) || Date.now();
      state.credited = Number(await AsyncStorage.getItem(dayStorageKey(state.day))) || 0;
      const saved = await AsyncStorage.getItem(counterStorageKey);
      state.baseline = saved ? (JSON.parse(saved) as StepCounterReading) : null;
      rebase = mode !== 'watch' && (await AsyncStorage.getItem(rebaseStorageKey)) === '1';
      if (cancelled) return;
      if (mode === 'counter' && !state.baseline && StepCounter?.getTotalSteps) {
        state.baseline = { steps: 0, bootCount: -1, totalSteps: StepCounter.getTotalSteps() };
        await AsyncStorage.setItem(counterStorageKey, JSON.stringify(state.baseline));
      }
      initialized = true;
      if (mode === 'counter') {
        if (Number(Platform.Version) >= 33 && !(await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS))) {
          await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
        }
        await startCounter();
      }
      if (cancelled) return;
      setPedometer('ready');
      show();
      if (mode === 'watch') {
        startWatch();
      } else {
        await sync().catch(() => {});
      }
    })().catch(() => { if (!cancelled) setPedometer('denied'); });

    const timer = setInterval(() => {
      if (mode === 'watch') flush(false);
      else sync().catch(() => {});
    }, SYNC_INTERVAL_MS);
    const appState = AppState.addEventListener('change', (next) => {
      if (next !== 'active') {
        if (mode === 'watch') { subscription?.remove(); subscription = undefined; }
        void flush(true);
      }
      if (next === 'active') {
        if (mode === 'watch') { if (deviceId) startWatch(); }
        else void startCounter().then(() => sync()).catch(() => {});
      }
    });

    return () => {
      cancelled = true;
      subscription?.remove();
      clearInterval(timer);
      appState.remove();
      flush(true);
    };
  }, [uid, foregroundOnly, backgroundSupported]);

  useEffect(() => {
    AsyncStorage.getItem(FOREGROUND_ONLY_KEY).then((value) => setForegroundOnlyState(value === 'on')).catch(() => setForegroundOnlyState(false));
    if (Platform.OS === 'web') {
      if (!navigator.permissions?.query) return;
      void navigator.permissions.query({name:'geolocation'}).then(permission=>setLocation(permission.state==='granted'?'ready':'denied')).catch(()=>setLocation('denied'));
      return;
    }
    Location.getForegroundPermissionsAsync().then(({ granted }) => setLocation(granted ? 'ready' : 'denied')).catch(()=>setLocation('denied'));
  }, []);

  useEffect(() => {
    if (location !== 'ready') return;
    let removed = false;
    let subscription: { remove: () => void } | undefined;
    freshPosition.current=false;
    const update = ({ coords }: Location.LocationObject) => {
      if (!removed) {
        const next={lat:coords.latitude,lng:coords.longitude};
        freshPosition.current=true;setPosition(next);
        void AsyncStorage.setItem('walk:lastPosition',JSON.stringify({...next,at:Date.now()})).catch(()=>{});
      }
    };
    void AsyncStorage.getItem('walk:lastPosition').then(raw=>{
      if (!raw || removed || freshPosition.current) return;
      const saved=JSON.parse(raw);
      if (Number.isFinite(saved.lat) && Math.abs(saved.lat)<=90 && Number.isFinite(saved.lng) && Math.abs(saved.lng)<=180 && Date.now()-saved.at>=0 && Date.now()-saved.at<10*60_000) setPosition({lat:saved.lat,lng:saved.lng});
    }).catch(()=>{});
    if (Platform.OS === 'web') {
      if (!navigator.geolocation) { setTimeout(()=>{if(!removed)setLocation('denied');},0);return; }
      const watch=navigator.geolocation.watchPosition(update,()=>{if(!removed)setLocation('denied');},{enableHighAccuracy:false,maximumAge:60_000,timeout:15_000});
      return ()=>{removed=true;freshPosition.current=false;navigator.geolocation.clearWatch(watch);};
    }
    Location.getLastKnownPositionAsync()
      .then((last) => last && Date.now()-last.timestamp<60_000 && update(last))
      .catch(() => {});
    Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, distanceInterval: 10, timeInterval: 10_000 },
      update,
    ).then((sub) => {
      if (removed) sub.remove();
      else subscription = sub;
    }).catch(() => { if (!removed) setLocation('denied'); });
    return () => {
      removed = true;
      freshPosition.current=false;
      subscription?.remove();
    };
  }, [location]);

  const username = profile?.username;
  const nickname = profile?.nickname;
  const avatar = profile?.avatar ?? null;
  useEffect(() => {
    if (!uid || !username || !position || !sharing || !freshPosition.current) return;
    const last = lastShare.current;
    if (last && last.uid === uid && last.audience === audience && last.avatar === avatar && last.nickname === nickname && Date.now() - last.at < SHARE_INTERVAL_MS) return;
    lastShare.current = { uid, audience, at: Date.now(), avatar, nickname };
    shareLocation(uid, { username, nickname }, avatar, position.lat, position.lng, audience).catch(() => {
      lastShare.current = null;
    });
  }, [uid, username, nickname, avatar, position, sharing, audience, shareTick]);

  async function requestLocation() {
    if (Platform.OS === 'web') {
      if (!navigator.geolocation) { setLocation('denied');return; }
      await new Promise<void>(resolve=>navigator.geolocation.getCurrentPosition(({coords})=>{
        setPosition({lat:coords.latitude,lng:coords.longitude});setLocation('ready');resolve();
      },()=>{setLocation('denied');resolve();},{enableHighAccuracy:false,maximumAge:60_000,timeout:15_000}));
      return;
    }
    try {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      setLocation(granted ? 'ready' : 'denied');
    } catch { setLocation('denied'); }
  }

  async function updateSharing(next: MapSharing) {
    if (!uid || !preference || sharingBusy) return;
    setSharingBusy(true);
    try {
      await saveMapSharing(uid, next);
      lastShare.current = null;
      setSharingError(false);
      void AsyncStorage.setItem(SHARING_KEY, next.sharing ? 'on' : 'off').catch(() => {});
      setShareTick(v => v + 1);
    } catch { setSharingError(true); Alert.alert('위치 공유 설정을 바꾸지 못했어요', '연결 상태를 확인하고 다시 시도해주세요.'); }
    finally { setSharingBusy(false); }
  }
  function setSharing(on: boolean) {
    void updateSharing({ sharing: on, audience });
  }
  function setFriendsOnly(on: boolean) {
    void updateSharing({ sharing, audience: on ? 'friends' : 'public' });
  }

  function setForegroundOnly(on: boolean) {
    if (!on && uid && (Platform.OS !== 'android' || !StepCounter?.startAsync)) AsyncStorage.setItem(`walk:${uid}:rebase`, '1');
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
        friendsOnly,
        setFriendsOnly,
        sharingBusy,
        sharingError,
        foregroundOnly: foregroundOnly ?? false,
        backgroundSupported,
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
