module.exports = {
  isLoaded: () => true,
  loadAsync: jest.fn().mockResolvedValue(undefined),
  useFonts: () => [true, null],
};
