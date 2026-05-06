const React = require('react');
const renderer = require('react-test-renderer');

const mockUpdateJournalEntry = jest.fn();
const mockSaveJournalEntry = jest.fn();
const mockGetJournalEntries = jest.fn();
const mockSavePromptAnswer = jest.fn();
const mockGetPromptAnswers = jest.fn();
const mockGetSharedPromptAnswers = jest.fn();
const mockDeletePromptAnswer = jest.fn();
const mockGetSharedDailyQuizQuestionSelection = jest.fn();
const mockSaveSharedDailyQuizQuestionSelection = jest.fn();
const mockNeedsReconnect = jest.fn(() => false);
const mockStorageGet = jest.fn();
const mockStorageSet = jest.fn();
const mockStorageRemove = jest.fn();
const mockAlert = jest.fn();
const mockShowPaywall = jest.fn();
const mockEntitlements = {
  isPremiumEffective: true,
  showPaywall: mockShowPaywall,
};
let mockAppContextState = { userId: 'user-1' };

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

jest.mock('expo-video', () => ({
  VideoView: mockCreateHostComponent('VideoView'),
  useVideoPlayer: jest.fn(() => ({})),
}));

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: {
    View: mockCreateHostComponent('AnimatedView'),
  },
  FadeIn: mockCreateAnimationChain(),
  FadeInDown: mockCreateAnimationChain(),
  FadeInUp: mockCreateAnimationChain(),
  useSharedValue: jest.fn((value) => ({ value })),
  useAnimatedStyle: jest.fn((factory) => factory()),
  withSpring: jest.fn((value) => value),
  interpolate: jest.fn((value) => value),
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

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  EncodingType: { Base64: 'base64' },
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true, size: 1024 }),
  readAsStringAsync: jest.fn().mockResolvedValue(''),
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
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
  useEntitlements: () => mockEntitlements,
}));

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
  }),
}));

jest.mock('../../context/AppContext', () => ({
  useAppContext: () => ({
    state: mockAppContextState,
  }),
}));

jest.mock('../../services/localfirst', () => ({
  DataLayer: {
    updateJournalEntry: (...args) => mockUpdateJournalEntry(...args),
    saveJournalEntry: (...args) => mockSaveJournalEntry(...args),
    getJournalEntries: (...args) => mockGetJournalEntries(...args),
    savePromptAnswer: (...args) => mockSavePromptAnswer(...args),
    getPromptAnswers: (...args) => mockGetPromptAnswers(...args),
    getSharedPromptAnswers: (...args) => mockGetSharedPromptAnswers(...args),
    deletePromptAnswer: (...args) => mockDeletePromptAnswer(...args),
    needsReconnect: (...args) => mockNeedsReconnect(...args),
    deleteJournalEntry: jest.fn(),
  },
}));

jest.mock('../../services/couple/CoupleStateService', () => {
  const actual = jest.requireActual('../../services/couple/CoupleStateService');
  return {
    ...actual,
    getSharedDailyQuizQuestionSelection: (...args) => mockGetSharedDailyQuizQuestionSelection(...args),
    saveSharedDailyQuizQuestionSelection: (...args) => mockSaveSharedDailyQuizQuestionSelection(...args),
  };
});

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
    xxxl: 32,
  },
  SYSTEM_FONT: 'System',
  SCREEN_TITLE_STYLE: {
    fontFamily: 'System',
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  getGradients: (colors) => ({
    screenBackground: [colors?.background || '#fff8f5', colors?.surface2 || '#f7efeb', colors?.background || '#fff8f5'],
  }),
  withAlpha: (color, alpha) => `${color}:${alpha}`,
}));

jest.mock('../../utils/storage', () => ({
  storage: {
    get: (...args) => mockStorageGet(...args),
    set: (...args) => mockStorageSet(...args),
    remove: (...args) => mockStorageRemove(...args),
  },
}));

const { Image, Text, TextInput, TouchableOpacity } = require('react-native');

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
  mockEntitlements.isPremiumEffective = true;
  mockAppContextState = { userId: 'user-1' };
  mockUpdateJournalEntry.mockResolvedValue(undefined);
  mockSaveJournalEntry.mockResolvedValue(undefined);
  mockGetJournalEntries.mockResolvedValue([]);
  mockSavePromptAnswer.mockResolvedValue(undefined);
  mockGetPromptAnswers.mockResolvedValue([]);
  mockGetSharedPromptAnswers.mockResolvedValue([]);
  mockDeletePromptAnswer.mockResolvedValue(undefined);
  mockGetSharedDailyQuizQuestionSelection.mockResolvedValue(null);
  mockSaveSharedDailyQuizQuestionSelection.mockResolvedValue(true);
  mockNeedsReconnect.mockReturnValue(false);
  mockStorageGet.mockResolvedValue(true);
  mockStorageSet.mockResolvedValue(undefined);
  mockStorageRemove.mockResolvedValue(undefined);
}

function setEntitlementsMock(overrides = {}) {
  Object.assign(mockEntitlements, overrides);
}

function setAppContextMock(state = {}) {
  mockAppContextState = { userId: 'user-1', ...state };
}

module.exports = {
  renderer,
  Image,
  TextInput,
  flushEffects,
  renderScreen,
  createNavigation,
  findTouchablesByText,
  resetScreenHarnessMocks,
  mockUpdateJournalEntry,
  mockSaveJournalEntry,
  mockGetJournalEntries,
  mockSavePromptAnswer,
  mockGetPromptAnswers,
  mockGetSharedPromptAnswers,
  mockDeletePromptAnswer,
  mockGetSharedDailyQuizQuestionSelection,
  mockSaveSharedDailyQuizQuestionSelection,
  mockNeedsReconnect,
  mockStorageGet,
  mockStorageSet,
  mockStorageRemove,
  mockAlert,
  mockShowPaywall,
  setAppContextMock,
  setEntitlementsMock,
};
