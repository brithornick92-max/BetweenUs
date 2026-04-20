const React = require('react');
const renderer = require('react-test-renderer');

const mockUpdateJournalEntry = jest.fn();
const mockSaveJournalEntry = jest.fn();
const mockGetJournalEntries = jest.fn();
const mockNeedsReconnect = jest.fn(() => false);
const mockStorageGet = jest.fn();
const mockStorageSet = jest.fn();
const mockAlert = jest.fn();

function mockCreateHostComponent(name) {
  const Component = (props) => React.createElement(name, props, props.children);
  Component.displayName = name;
  return Component;
}

function mockCreateAnimationChain() {
  return {
    duration: () => mockCreateAnimationChain(),
    delay: () => mockCreateAnimationChain(),
    springify: () => mockCreateAnimationChain(),
    damping: () => mockCreateAnimationChain(),
  };
}

jest.mock('react-native', () => {
  const ReactLocal = require('react');
  const View = mockCreateHostComponent('View');
  const Text = mockCreateHostComponent('Text');
  const ScrollView = mockCreateHostComponent('ScrollView');
  const Image = mockCreateHostComponent('Image');
  const TextInput = mockCreateHostComponent('TextInput');
  const TouchableOpacity = mockCreateHostComponent('TouchableOpacity');
  const KeyboardAvoidingView = mockCreateHostComponent('KeyboardAvoidingView');
  const ActivityIndicator = mockCreateHostComponent('ActivityIndicator');
  const StatusBar = mockCreateHostComponent('StatusBar');
  const RefreshControl = mockCreateHostComponent('RefreshControl');

  const FlatList = ({
    data = [],
    renderItem,
    ListHeaderComponent = null,
    ListEmptyComponent = null,
  }) => ReactLocal.createElement(
    'FlatList',
    null,
    ListHeaderComponent,
    data.length
      ? data.map((item, index) => renderItem({ item, index }))
      : ListEmptyComponent
  );

  return {
    View,
    Text,
    ScrollView,
    Image,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    ActivityIndicator,
    StatusBar,
    RefreshControl,
    FlatList,
    StyleSheet: {
      create: (styles) => styles,
      absoluteFillObject: {},
    },
    Platform: {
      OS: 'ios',
      select: (options) => options.ios,
    },
    Dimensions: {
      get: () => ({ width: 390, height: 844 }),
    },
    Alert: {
      alert: mockAlert,
    },
    Keyboard: {
      dismiss: jest.fn(),
    },
  };
});

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: mockCreateHostComponent('SafeAreaView'),
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: mockCreateHostComponent('LinearGradient'),
}));

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: {
    View: mockCreateHostComponent('AnimatedView'),
  },
  FadeIn: mockCreateAnimationChain(),
  FadeInDown: mockCreateAnimationChain(),
  FadeInUp: mockCreateAnimationChain(),
}));

jest.mock('@react-navigation/native', () => {
  const ReactLocal = require('react');
  return {
    useFocusEffect: (callback) => {
      ReactLocal.useEffect(() => {
        const cleanup = callback();
        return typeof cleanup === 'function' ? cleanup : undefined;
      }, [callback]);
    },
  };
});

jest.mock('../../components/Icon', () => mockCreateHostComponent('Icon'));
jest.mock('../../components/FilmGrain', () => mockCreateHostComponent('FilmGrain'));
jest.mock('../../components/GlowOrb', () => mockCreateHostComponent('GlowOrb'));

jest.mock('../../utils/haptics', () => ({
  impact: jest.fn(),
  notification: jest.fn(),
  selection: jest.fn(),
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium' },
  NotificationFeedbackType: { Success: 'Success' },
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: true, assets: [] }),
  MediaTypeOptions: { Images: 'Images' },
}));

jest.mock('../../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff8f5',
      surface: '#ffffff',
      surface2: '#f7efeb',
      primary: '#d2121a',
      accent: '#d4aa7e',
      text: '#1f1720',
      textMuted: '#6f6670',
      border: '#eaded8',
    },
    isDark: false,
  }),
}));

jest.mock('../../context/EntitlementsContext', () => ({
  useEntitlements: () => ({
    isPremiumEffective: true,
    showPaywall: jest.fn(),
  }),
}));

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
  }),
}));

jest.mock('../../context/AppContext', () => ({
  useAppContext: () => ({
    state: { userId: 'user-1' },
  }),
}));

jest.mock('../../services/localfirst', () => ({
  DataLayer: {
    updateJournalEntry: (...args) => mockUpdateJournalEntry(...args),
    saveJournalEntry: (...args) => mockSaveJournalEntry(...args),
    getJournalEntries: (...args) => mockGetJournalEntries(...args),
    needsReconnect: (...args) => mockNeedsReconnect(...args),
    deleteJournalEntry: jest.fn(),
  },
}));

jest.mock('../../utils/featureFlags', () => ({
  PremiumFeature: {
    UNLIMITED_JOURNAL_HISTORY: 'UNLIMITED_JOURNAL_HISTORY',
  },
}));

jest.mock('../../utils/theme', () => ({
  SPACING: {
    screen: 20,
    lg: 16,
    md: 12,
    sm: 8,
    xs: 4,
  },
  withAlpha: (color, alpha) => `${color}:${alpha}`,
}));

jest.mock('../../utils/storage', () => ({
  storage: {
    get: (...args) => mockStorageGet(...args),
    set: (...args) => mockStorageSet(...args),
  },
}));

const { Image, Text, TouchableOpacity } = require('react-native');

async function flushEffects() {
  await renderer.act(async () => {
    await Promise.resolve();
  });
}

async function renderScreen(Component, props = {}) {
  let tree;
  await renderer.act(async () => {
    tree = renderer.create(React.createElement(Component, props));
  });
  return tree;
}

function createNavigation(overrides = {}) {
  return {
    goBack: jest.fn(),
    navigate: jest.fn(),
    ...overrides,
  };
}

function findTouchablesByText(root, textValue) {
  return root.findAllByType(TouchableOpacity).filter((node) =>
    node.findAll((child) => child.type === Text && child.props.children === textValue).length > 0
  );
}

function resetScreenHarnessMocks() {
  jest.clearAllMocks();
  mockUpdateJournalEntry.mockResolvedValue(undefined);
  mockSaveJournalEntry.mockResolvedValue(undefined);
  mockGetJournalEntries.mockResolvedValue([]);
  mockNeedsReconnect.mockReturnValue(false);
  mockStorageGet.mockResolvedValue(true);
  mockStorageSet.mockResolvedValue(undefined);
}

module.exports = {
  renderer,
  Image,
  flushEffects,
  renderScreen,
  createNavigation,
  findTouchablesByText,
  resetScreenHarnessMocks,
  mockUpdateJournalEntry,
  mockSaveJournalEntry,
  mockGetJournalEntries,
  mockNeedsReconnect,
  mockStorageGet,
  mockStorageSet,
  mockAlert,
};