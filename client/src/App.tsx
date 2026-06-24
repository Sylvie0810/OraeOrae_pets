import { useEffect, useState } from "react";
import { Route, Switch } from "wouter";
import { useAuth } from "./lib/auth";
import { TabBar } from "./components/TabBar";
import { DogSwitcher } from "./components/DogSwitcher";
import { Logo } from "./components/Logo";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Today from "./pages/Today";
import Weight from "./pages/Weight";
import Health from "./pages/Health";
import Expenses from "./pages/Expenses";
import Settings from "./pages/Settings";

// The paw splash shows for exactly this long on launch, then we move on — we do
// NOT wait for the server. With the cached session (see auth.tsx) the home
// screen is ready immediately, so the paw never lingers past 1s even when the
// server is cold-starting (which is what made it sit for ~10s before).
const SPLASH_MS = 1000;

export default function App() {
  const { user } = useAuth();

  const [splashDone, setSplashDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSplashDone(true), SPLASH_MS);
    return () => clearTimeout(t);
  }, []);

  // Paw for exactly 1s, then move on no matter what the server is doing. A
  // returning user has a cached session, so we land straight on Home; a logged-
  // out user lands on Login. (auth keeps resolving in the background and
  // corrects the view if needed — but the paw never lingers past 1s.)
  if (!splashDone) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <div className="animate-rise">
          <Logo size={72} />
        </div>
      </div>
    );
  }

  if (!user) return <Login />;
  return (
    <div className="mx-auto min-h-screen max-w-md bg-canvas pb-24">
      <DogSwitcher />
      <main className="px-4 pt-1">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/today" component={Today} />
          <Route path="/weight" component={Weight} />
          <Route path="/health" component={Health} />
          <Route path="/expenses" component={Expenses} />
          <Route path="/settings" component={Settings} />
        </Switch>
      </main>
      <TabBar />
    </div>
  );
}
