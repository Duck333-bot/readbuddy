import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Library from "./pages/Library";
import Notebook from "./pages/Notebook";
import Reader from "./pages/Reader";
import AlphaDashboard from "./pages/AlphaDashboard";
import AuthPage from "./pages/AuthPage";

const LoginPage = () => <AuthPage />;
const CreateAccountPage = () => <AuthPage create />;

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
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
