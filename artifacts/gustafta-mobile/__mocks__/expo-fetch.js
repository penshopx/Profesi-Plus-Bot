// jest mock for expo/fetch — re-export global fetch so tests can override it.
module.exports = {
  fetch: (...args) => global.fetch(...args),
};
