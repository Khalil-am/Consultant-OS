import '@testing-library/jest-dom';
import { beforeAll, afterAll } from 'vitest';

// Mock crypto.randomUUID for test environments
Object.defineProperty(globalThis, 'crypto', {
  value: { randomUUID: () => 'test-uuid-' + Math.random().toString(36).slice(2) },
});

// Mock localStorage
const localStorageData: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => localStorageData[key] ?? null,
  setItem: (key: string, value: string) => { localStorageData[key] = value; },
  removeItem: (key: string) => { delete localStorageData[key]; },
  clear: () => { Object.keys(localStorageData).forEach(k => delete localStorageData[k]); },
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Silence console.error for expected test errors
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('Not implemented')) return;
    originalError(...args);
  };
});
afterAll(() => { console.error = originalError; });
