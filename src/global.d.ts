import { SleuthAPI } from './preload/preload';

declare global {
  interface Window {
    Sleuth: typeof SleuthAPI;
  }
}

export {};
