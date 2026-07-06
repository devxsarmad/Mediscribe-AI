import { env } from "../../config/env";
import type { LisAdapter } from "./lis-adapter.types";
import { mockLisAdapter } from "./mock-lis.adapter";
import { realLisAdapter } from "./real-lis.adapter";

export function getLisAdapter(): LisAdapter {
  return env.lisAdapterMode === "real" ? realLisAdapter : mockLisAdapter;
}
