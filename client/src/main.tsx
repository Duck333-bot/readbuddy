import { createRoot } from "react-dom/client";
import "./index.css";

const root = createRoot(document.getElementById("root")!);
const render = (App: React.ComponentType) => root.render(<App />);

// Public visitors should not pay to parse the reader, PDF, notebook, and app
// navigation code before seeing the landing. Every authenticated route keeps
// its normal application shell and behavior after its own module loads.
const isPublicLanding = window.location.pathname === "/";
const appModule = isPublicLanding ? import("./PublicApp") : import("./AuthenticatedApp");
appModule.then(({ default: App }) => render(App));
