module.exports = {
  preset: "jest-expo",
  setupFiles: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
  testMatch: ["<rootDir>/tests/**/*.test.ts?(x)", "<rootDir>/src/**/*.test.ts?(x)"],
  transformIgnorePatterns: ["node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg))"],
};
