const React = require('react');
const { View } = require('react-native');

const insets = { top: 0, right: 0, bottom: 0, left: 0 };

module.exports = {
  SafeAreaProvider: ({ children }) => React.createElement(View, null, children),
  SafeAreaView: ({ children }) => React.createElement(View, null, children),
  useSafeAreaInsets: () => insets,
  SafeAreaInsetsContext: { Consumer: ({ children }) => children(insets) },
};
