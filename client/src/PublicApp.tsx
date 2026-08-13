import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";

/** Lightweight public surface; avoid importing reader, upload, notebook, or app chrome. */
export default function PublicApp() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <Home />
      </ThemeProvider>
    </ErrorBoundary>
  );
}
