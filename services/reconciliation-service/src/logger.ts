import pino from "pino";
import { settings } from "./config.js";

export const logger = pino({ level: settings.logLevel });

