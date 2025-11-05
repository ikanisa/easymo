export default {
  rootDir: "./",
  moduleFileExtensions: ["js", "json", "ts"],
  testRegex: "test/.*\\.spec\\.ts$",
  transform: {
    "^.+\\.(t|j)s$": ["ts-jest", { tsconfig: "tsconfig.json" }],
  },
  testEnvironment: "node"
};
