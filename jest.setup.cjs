// Jest setup file
require('react-native-gesture-handler/jestSetup');

// Mock React Native modules
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: jest.fn((obj) => obj.ios),
  },
  Dimensions: {
    get: jest.fn(() => ({ width: 375, height: 812 })),
  },
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  getAllKeys: jest.fn(),
  clear: jest.fn(),
}));

// Mock Expo modules
jest.mock('expo-crypto', () => ({
  digestStringAsync: jest.fn(),
  randomUUID: jest.fn(() => 'mock-uuid-' + Math.random().toString(36).slice(2)),
}));

// Mock Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      onAuthStateChange: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    })),
  })),
}));

// Mock @noble/hashes (replaces crypto-js)
jest.mock('@noble/hashes/pbkdf2.js', () => ({
  pbkdf2: jest.fn(() => new Uint8Array(32)),
}));
jest.mock('@noble/hashes/sha2.js', () => ({
  sha256: jest.fn(),
}));

// Increase timeout for property-based tests
jest.setTimeout(30000);

// Global test utilities
global.console = {
  ...console,
  // Suppress console.log in tests unless needed
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};