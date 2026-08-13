const React = require('react');
const { Text } = require('react-native');

// Replace every icon set with a plain Text that renders the icon name.
const IconProxy = ({ name, ...rest }) => React.createElement(Text, rest, name ?? '');

module.exports = {
  Feather: IconProxy,
  MaterialIcons: IconProxy,
  Ionicons: IconProxy,
  AntDesign: IconProxy,
  FontAwesome: IconProxy,
  FontAwesome5: IconProxy,
  Entypo: IconProxy,
};
module.exports.default = IconProxy;
