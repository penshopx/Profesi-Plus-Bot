/**
 * Full react-native mock for Jest.
 * Replaces all native components with lightweight React stubs so tests run
 * in plain Node without any native bridge or JNI layer.
 */
const React = require('react');

// ── Core style helper ─────────────────────────────────────────────────────────

const StyleSheet = {
  create: (styles) => styles,
  flatten: (style) => (Array.isArray(style) ? Object.assign({}, ...style) : style ?? {}),
  compose: (a, b) => [a, b],
  hairlineWidth: 1,
  absoluteFillObject: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  absoluteFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
};

// ── Stub factory ──────────────────────────────────────────────────────────────

function makeStub(displayName) {
  const Comp = React.forwardRef(function MockComponent(props, ref) {
    const { children, testID, style, ...rest } = props;
    return React.createElement('View', { ref, testID, ...rest }, children);
  });
  Comp.displayName = displayName;
  return Comp;
}

// ── Component stubs ───────────────────────────────────────────────────────────

const View = makeStub('View');

const Text = React.forwardRef(function MockText(props, ref) {
  const { children, testID, style, ...rest } = props;
  return React.createElement('Text', { ref, testID, ...rest }, children);
});
Text.displayName = 'Text';

const TextInput = React.forwardRef(function MockTextInput(props, ref) {
  const {
    value, onChangeText, testID, placeholder, style,
    placeholderTextColor, autoCapitalize, autoCorrect, keyboardType, ...rest
  } = props;
  // Render as a View-like host element so react-test-renderer's findByProps
  // returns an element whose props include 'onChangeText' (the RN API name).
  return React.createElement('View', {
    ref,
    testID,
    value: value ?? '',
    onChangeText,
    placeholder,
    ...rest,
  });
});
TextInput.displayName = 'TextInput';

const Pressable = React.forwardRef(function MockPressable(props, ref) {
  const { children, onPress, disabled, testID, style, ...rest } = props;
  const resolvedStyle = typeof style === 'function' ? style({ pressed: false }) : style;
  const resolvedChildren = typeof children === 'function' ? children({ pressed: false }) : children;
  return React.createElement(
    'View',
    { ref, testID, onClick: disabled ? undefined : onPress, ...rest },
    resolvedChildren,
  );
});
Pressable.displayName = 'Pressable';

const TouchableOpacity = React.forwardRef(function MockTouchableOpacity(props, ref) {
  const { children, onPress, disabled, testID, style, ...rest } = props;
  return React.createElement(
    'View',
    { ref, testID, onClick: disabled ? undefined : onPress, ...rest },
    children,
  );
});

const ActivityIndicator = React.forwardRef(function MockActivityIndicator(props, ref) {
  const { testID, ...rest } = props;
  return React.createElement('View', { ref, testID, ...rest });
});
ActivityIndicator.displayName = 'ActivityIndicator';

const ScrollView = makeStub('ScrollView');
const KeyboardAvoidingView = makeStub('KeyboardAvoidingView');
// FlatList renders its data through renderItem (plus header/footer/empty
// components) so list-based screens can be tested with react-test-renderer.
const FlatList = React.forwardRef(function MockFlatList(props, ref) {
  const {
    data = [],
    renderItem,
    keyExtractor,
    ListHeaderComponent,
    ListFooterComponent,
    ListEmptyComponent,
    testID,
    ...rest
  } = props;
  const renderMaybe = (Comp) =>
    Comp == null ? null : React.isValidElement(Comp) ? Comp : React.createElement(Comp);
  const items = (data ?? []).map((item, index) =>
    React.createElement(
      React.Fragment,
      { key: keyExtractor ? keyExtractor(item, index) : String(index) },
      renderItem ? renderItem({ item, index, separators: {} }) : null,
    ),
  );
  return React.createElement(
    'View',
    { ref, testID },
    renderMaybe(ListHeaderComponent),
    (data ?? []).length === 0 ? renderMaybe(ListEmptyComponent) : items,
    renderMaybe(ListFooterComponent),
  );
});
FlatList.displayName = 'FlatList';
const SafeAreaView = makeStub('SafeAreaView');
const Modal = makeStub('Modal');
const Image = makeStub('Image');
const ImageBackground = makeStub('ImageBackground');
const TouchableHighlight = makeStub('TouchableHighlight');
const TouchableWithoutFeedback = makeStub('TouchableWithoutFeedback');

// ── Hooks / APIs ──────────────────────────────────────────────────────────────

const useColorScheme = jest.fn(() => 'light');
const useWindowDimensions = jest.fn(() => ({ width: 390, height: 844, scale: 3, fontScale: 1 }));
const Platform = {
  OS: 'ios',
  Version: 17,
  isPad: false,
  isTVOS: false,
  select: (obj) => (obj.ios !== undefined ? obj.ios : obj.default),
};
const Dimensions = {
  get: jest.fn(() => ({ width: 390, height: 844, scale: 3, fontScale: 1 })),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
};
const Keyboard = {
  dismiss: jest.fn(),
  addListener: jest.fn(() => ({ remove: jest.fn() })),
};
const Animated = {
  Value: class {
    constructor(val) { this._val = val; }
    setValue(v) { this._val = v; }
    interpolate() { return this; }
  },
  timing: () => ({ start: jest.fn(), stop: jest.fn() }),
  spring: () => ({ start: jest.fn(), stop: jest.fn() }),
  sequence: () => ({ start: jest.fn() }),
  parallel: () => ({ start: jest.fn() }),
  View: makeStub('Animated.View'),
  Text: makeStub('Animated.Text'),
  createAnimatedComponent: (C) => C,
};
const Easing = { linear: (t) => t, ease: (t) => t, in: (e) => e, out: (e) => e, inOut: (e) => e };
const Alert = { alert: jest.fn() };
const BackHandler = { addEventListener: jest.fn(() => ({ remove: jest.fn() })), removeEventListener: jest.fn() };
const NativeModules = {};
const NativeEventEmitter = class { constructor() {} addListener() { return { remove: jest.fn() }; } removeAllListeners() {} };
const AppState = { currentState: 'active', addEventListener: jest.fn(() => ({ remove: jest.fn() })) };
const Linking = { openURL: jest.fn(), addEventListener: jest.fn(() => ({ remove: jest.fn() })) };

module.exports = {
  // components
  View,
  Text,
  TextInput,
  Pressable,
  TouchableOpacity,
  TouchableHighlight,
  TouchableWithoutFeedback,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  FlatList,
  SafeAreaView,
  Modal,
  Image,
  ImageBackground,
  // style
  StyleSheet,
  // hooks & APIs
  useColorScheme,
  useWindowDimensions,
  Platform,
  Dimensions,
  Keyboard,
  Animated,
  Easing,
  Alert,
  BackHandler,
  NativeModules,
  NativeEventEmitter,
  AppState,
  Linking,
  // utilities
  I18nManager: { isRTL: false },
  PixelRatio: { get: () => 3, getFontScale: () => 1, roundToNearestPixel: (v) => v },
  Vibration: { vibrate: jest.fn(), cancel: jest.fn() },
  AccessibilityInfo: { isReduceMotionEnabled: jest.fn().mockResolvedValue(false) },
  DeviceEventEmitter: { addListener: jest.fn(() => ({ remove: jest.fn() })), emit: jest.fn() },
  InteractionManager: { runAfterInteractions: (fn) => { fn(); return { then: jest.fn(), cancel: jest.fn() }; } },
  Share: { share: jest.fn() },
  StatusBar: { setBarStyle: jest.fn(), setHidden: jest.fn() },
};
