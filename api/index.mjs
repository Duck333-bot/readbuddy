// Vercel's Node runtime loads this small stable entrypoint. The build command
// produces the bundled Express application in dist so local TypeScript module
// paths do not leak into the serverless runtime.
import app from "../dist/vercel-app.mjs";

export default app;
