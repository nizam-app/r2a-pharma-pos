import pino from "pino";
import { env } from "../config";

export const logger = pino({
  level: env.nodeEnv === "production" ? "info" : "debug",
  base: { service: "@r2a/server" },
  timestamp: pino.stdTimeFunctions.isoTime,
});
