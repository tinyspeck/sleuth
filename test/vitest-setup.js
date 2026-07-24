import { vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

// antd v6 (@rc-component/resize-observer) requires ResizeObserver
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Default mock for the `window.Sleuth` preload API. Real values are provided
// for the fields components branch on; any other property resolves to a no-op mock.
// `setup*` methods in the real API return a cleanup function, so the fallback
// returns one too.
window.Sleuth = new Proxy(
  {
    platform: 'darwin',
    versions: {},
    sleuthVersion: '0.0.0-test',
  },
  {
    get(target, prop) {
      if (prop in target) return target[prop];
      return vi.fn(() => vi.fn());
    },
  },
);

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
