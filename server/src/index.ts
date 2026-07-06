import { app } from "./app";
import { connectDatabase } from "./config/database";
import { env } from "./config/env";

async function bootstrap() {
  try {
    await connectDatabase();

    const server = app.listen(env.port, () => {
      console.log(`MediScribe API listening on http://localhost:${env.port}`);
      console.log(`STT provider: ${env.sttProvider}`);
      if (env.sttProvider === "local") {
        console.log(`Local STT URL: ${env.localSttUrl}`);
      }
    });

    server.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") {
        console.error(
          `Port ${env.port} is already in use. Stop the other process or set PORT to another value in server/.env.`,
        );
        process.exit(1);
      }

      console.error("MediScribe API server error.", error);
      process.exit(1);
    });
  } catch (error) {
    console.error("Failed to start MediScribe API.", error);
    process.exit(1);
  }
}

void bootstrap();
