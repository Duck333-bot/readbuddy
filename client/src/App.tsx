import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import { lazy, Suspense } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";

// Keep the unauthenticated marketing route lean. The reading product loads only
// when somebody asks for it, rather than making the landing wait for the PDF,
// reader, notebook, and admin surfaces.
const Library = lazy(() => import("./pages/Library"));
const Notebook = lazy(() => import("./pages/Notebook"));
const Reader = lazy(() => import("./pages/Reader"));
const AlphaDashboard = lazy(() => import("./pages/AlphaDashboard"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const LoginPage = () => <AuthPage />;
const CreateAccountPage = () => <AuthPage create />;

function RouteBoot() {
  return <div className="min-h-screen bg-[#fbf8f0]" aria-label="Loading ZhiyaAI" />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/library" component={Library} />
      <Route path="/read/:bookId" component={Reader} />
      <Route path="/notebook" component={Notebook} />
      <Route path="/alpha" component={AlphaDashboard} />
      <Route path="/login" component={LoginPage} />
      <Route path="/create-account" component={CreateAccountPage} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider delayDuration={300}>
          <Toaster />
          <Suspense fallback={<RouteBoot />}>
            <Router />
          </Suspense>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
