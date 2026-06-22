import { useEffect } from "react";
import { Route, Switch } from "wouter";
import { useAuth } from "./lib/auth";
import { TabBar } from "./components/TabBar";
import { DogSwitcher } from "./components/DogSwitcher";
import { dismissSplash } from "./main";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Today from "./pages/Today";
import Weight from "./pages/Weight";
import Health from "./pages/Health";
import Expenses from "./pages/Expenses";
import Settings from "./pages/Settings";

export default function App() {
  const { user, loading } = useAuth();

  // Keep the instant HTML splash up until auth resolves, then fade it out.
  // This avoids a second, separate React loading screen ("icon-only" → "slogan").
  useEffect(() => {
    if (!loading) dismissSplash();
  }, [loading]);

  if (loading) return null; // static #splash from index.html is still covering the screen
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
