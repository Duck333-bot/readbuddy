import { startServer } from "./index";

startServer().catch(error => {
  console.error(error instanceof Error ? error.message : "Startup failed");
  process.exitCode = 1;
});
