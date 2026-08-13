/** @type {import('jest').Config} */
module.exports = {
  // No preset — we configure everything manually to avoid the ESM/pnpm
  // incompatibility in @react-native/jest-preset's setup.js.
  testEnvironment: 'node',
  transform: {
    '^.+\\.[jt]sx?$': [
      'babel-jest',
      {
        // Reuse the project's own babel config (babel-preset-expo).
        configFile: require.resolve('./babel.config.js'),
      },
    ],
  },
  // Transform everything except clearly CJS-only packages.
  // pnpm stores packages under node_modules/.pnpm/<pkg>/node_modules/<pkg>.
  // If we don't include '.pnpm' in the exception list, the regex matches at the
  // first /node_modules/ and ignores everything after (including ESM packages).
  // Including '.pnpm' makes the regex fall through to the second /node_modules/
  // where the actual package name is checked.
  transformIgnorePatterns: [
    '/node_modules/(?!(' +
      '\\.pnpm|' +
      '@tanstack|' +
      'expo|' +
      'expo-modules-core|' +
      'nanoid' +
    '))',
  ],
  // react-native → our lightweight CJS stub (avoids native bridge load)
  moduleNameMapper: {
    '^react-native$': '<rootDir>/__mocks__/react-native.js',
    '^react-native/(.*)$': '<rootDir>/__mocks__/react-native.js',
    '^@react-native/(.*)$': '<rootDir>/__mocks__/react-native.js',
    '^@/(.*)$': '<rootDir>/$1',
    '^expo/fetch$': '<rootDir>/__mocks__/expo-fetch.js',
    '^@expo/vector-icons$': '<rootDir>/__mocks__/@expo/vector-icons.js',
    '^@expo/vector-icons/(.*)$': '<rootDir>/__mocks__/@expo/vector-icons.js',
    '^react-native-safe-area-context$': '<rootDir>/__mocks__/react-native-safe-area-context.js',
    // Silence asset imports (fonts, images)
    '\\.(jpg|jpeg|png|gif|svg|ttf|otf|woff|woff2)$': '<rootDir>/__mocks__/fileMock.js',
  },
  setupFiles: ['<rootDir>/jest.setup.js'],
  testMatch: ['**/__tests__/**/*.test.[jt]s?(x)'],
  testPathIgnorePatterns: ['/node_modules/'],
};
