export const createTestId = (prefix = "test") =>
  `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
