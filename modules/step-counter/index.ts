import { requireOptionalNativeModule } from 'expo';

export type StepCounterReading = {
  /** Steps since the phone last booted. */
  steps: number;
  /** Changes on every reboot, when `steps` starts over from 0; -1 if unknown. */
  bootCount: number;
};

type StepCounterModule = {
  isAvailable(): boolean;
  readAsync(): Promise<StepCounterReading | null>;
};

/** Android's hardware step counter; null on iOS, web and in Expo Go, which don't include this module. */
export const StepCounter = requireOptionalNativeModule<StepCounterModule>('StepCounter');