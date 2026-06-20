import { vi } from 'vitest';

// In Node 26 with happy-dom, window.localStorage proxies to Node's experimental
// localStorage global which is undefined without --localstorage-file. Replace it
// with a plain in-memory mock before any test modules load.
let store: Record<string, string> = {};
const mockStorage: Storage = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, val: string) => { store[key] = val; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { store = {}; },
  get length() { return Object.keys(store).length; },
  key: (i: number) => Object.keys(store)[i] ?? null,
};

vi.stubGlobal('localStorage', mockStorage);
