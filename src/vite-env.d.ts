/// <reference types="vite/client" />

// Global Buffer polyfill
import type { Buffer as BufferType } from 'buffer';

declare global {
  interface Window {
    Buffer: typeof BufferType;
  }

  // Make Buffer available globally in modules
  const Buffer: typeof BufferType;
}

export {};
