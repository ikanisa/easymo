export default {
  rootDir: "./",
  moduleFileExtensions: ["js", "json", "ts"],
  testEnvironment: "node",
  testRegex: "test/.*\\.spec\\.ts$",
  transform: {
    "^.+\\.(t|j)s$": ["ts-jest", { tsconfig: "tsconfig.json" }]
  }
};
