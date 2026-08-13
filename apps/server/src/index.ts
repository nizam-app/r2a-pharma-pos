import { env } from "./config";
import app from "./app";
import { logger } from "./utils";

const server = app.listen(env.port, () => {
  logger.info(
    {
      port: env.port,
      nodeEnv: env.nodeEnv,
      envFile: env.rootEnvPath,
      databaseUrlSet: Boolean(env.databaseUrl),
      jwtSecretSet: Boolean(env.jwtSecret),
      corsOrigins: env.corsOrigins,
    },
    "@r2a/server listening",
  );
});

function shutdown(signal: string) {
  logger.info({ signal }, "shutting down");
  server.close(() => process.exit(0));
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
