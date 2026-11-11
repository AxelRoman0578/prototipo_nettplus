import { resolve } from "node:path";
import { createApp } from "./app";

try {
  process.loadEnvFile();
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}
const port = Number(process.env.NETTPLUS_PORT || 3001);
const { server, store } = await createApp({
  dbPath: resolve(process.env.NETTPLUS_DB || "data/nettplus.sqlite"),
  seed: process.env.NETTPLUS_SEED_DEMO !== "false",
});
server.listen(port, "127.0.0.1", () =>
  console.log(`Nettplus API local: http://127.0.0.1:${port}`),
);
function close() {
  server.close(() => {
    store.close();
    process.exit(0);
  });
}
process.on("SIGINT", close);
process.on("SIGTERM", close);
