import { Route, Switch } from "wouter";
import { useAuth } from "./lib/auth";
import { TabBar } from "./components/TabBar";
import { DogSwitcher } from "./components/DogSwitcher";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Today from "./pages/Today";
import Weight from "./pages/Weight";
import Expenses from "./pages/Expenses";
import Settings from "./pages/Settings";

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-6">불러오는 중…</div>;
  if (!user) return <Login />;
  return (
    <div className="mx-auto max-w-md pb-20">
      <DogSwitcher />
      <main className="px-4">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/today" component={Today} />
          <Route path="/weight" component={Weight} />
          <Route path="/expenses" component={Expenses} />
          <Route path="/settings" component={Settings} />
        </Switch>
      </main>
      <TabBar />
    </div>
  );
}
