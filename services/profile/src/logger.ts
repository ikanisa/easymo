import pino from "pino";

import { settings } from "./config";

export const logger = pino({
  level: settings.env === "production" ? "info" : "debug",
  formatters: {
    level: (label) => ({ level: label }),
  },
  base: {
    service: "profile-service",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});
