import { requireOptionalNativeModule } from 'expo';

export type StepCounterReading = {
  /** Steps since the phone last booted. */
  steps: number;
  /** Changes on every reboot, when `steps` starts over from 0; -1 if unknown. */
  bootCount: number;
  /** Today's steps recorded by the background service, excluding previous days. */
  todaySteps?: number;
  /** Durable background total that survives phone reboots; excludes foreground-only periods. */
  totalSteps?: number;
};

type StepCounterModule = {
  /** Starts/stops the Android low-power background counter and its ongoing notification. */
  startAsync?: () => Promise<boolean>;
  stopAsync?: () => Promise<void>;
  addForegroundAsync?: (steps: number) => Promise<void>;
  isAvailable(): boolean;
  getTotalSteps?: () => number;
  readAsync(): Promise<StepCounterReading | null>;
};

/** Android's hardware step counter and health service; null on iOS, web and in Expo Go. */
export const StepCounter = requireOptionalNativeModule<StepCounterModule>('StepCounter');
