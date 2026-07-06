import mongoose from "mongoose";
import { env } from "./env";

export async function connectDatabase() {
  if (!env.mongodbUri) {
    console.warn("MongoDB connection skipped: MONGODB_URI is not configured.");
    return;
  }

  try {
    await mongoose.connect(env.mongodbUri);
    console.log("MongoDB connected.");
  } catch (error) {
    console.error("MongoDB connection failed:", error);
    if (env.mongodbRequired) {
      throw error;
    }

    console.warn(
      "Continuing without MongoDB because MONGODB_REQUIRED is false. Save/list note APIs will return 503 until MongoDB is connected.",
    );
  }
}
