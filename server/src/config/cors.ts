import type { CorsOptions } from "cors";
import { env } from "./env";

const allowedOrigins = env.clientOrigins;

function isLocalDevOrigin(origin: string) {
  if (env.nodeEnv !== "development") {
    return false;
  }

  return /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
}

export const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || isLocalDevOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS blocked origin: ${origin}`));
  },
};
