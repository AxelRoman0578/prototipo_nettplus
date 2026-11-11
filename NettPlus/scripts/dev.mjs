import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
const require = createRequire(import.meta.url);
const children = [
  spawn(process.execPath, ["--import", "tsx", "server/index.ts"], {
    stdio: "inherit",
  }),
  spawn(
    process.execPath,
    [
      resolve(dirname(require.resolve("vite/package.json")), "bin/vite.js"),
      "--host",
      "localhost",
      "--port",
      "5173",
      "--strictPort",
    ],
    { stdio: "inherit" },
  ),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  children.forEach((child) => child.kill());
  process.exitCode = code;
}
children.forEach((child) => {
  child.on("error", (error) => {
    console.error(error.message);
    stop(1);
  });
  child.on("exit", (code) => stop(code ?? 0));
});
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
