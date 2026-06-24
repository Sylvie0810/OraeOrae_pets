import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

interface User { id: number; email: string; name: string; }
interface AuthCtx { user: User | null; loading: boolean; refetch: () => void; }
const AuthContext = createContext<AuthCtx>({ user: null, loading: true, refetch: () => {} });

// We cache the last-known user in localStorage so re-opening the app renders the
// home screen instantly (optimistic), instead of staring at the paw splash for
// the 1–3s it takes /api/auth/me to round-trip (Cloud Run cold start). The query
// still runs in the background and corrects the state if the session expired.
const CACHE_KEY = "oraeorae.user";
function readCachedUser(): User | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch { return null; }
}
// Call on logout so the optimistic cache can't briefly re-render the app while
// the /api/auth/me refetch is in flight.
export function clearAuthCache() {
  try { localStorage.removeItem(CACHE_KEY); } catch { /* non-fatal */ }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [cached] = useState<User | null>(readCachedUser);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["me"],
    queryFn: () => api<User>("/api/auth/me").catch(() => null),
  });

  // Keep the cache in sync once the real check resolves.
  useEffect(() => {
    if (isLoading) return;
    try {
      if (data) localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      else localStorage.removeItem(CACHE_KEY);
    } catch { /* private mode / storage full — non-fatal */ }
  }, [data, isLoading]);

  // user: prefer the verified result; fall back to cache while it's loading.
  // loading: only true on a true cold start (loading AND no cache to show).
  const user = data ?? (isLoading ? cached : null);
  return <AuthContext.Provider value={{ user, loading: isLoading && !cached, refetch }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);

interface DogCtx { dogId: number | null; setDogId: (id: number) => void; }
const DogContext = createContext<DogCtx>({ dogId: null, setDogId: () => {} });
export function DogProvider({ children }: { children: ReactNode }) {
  const [dogId, setDogId] = useState<number | null>(null);
  return <DogContext.Provider value={{ dogId, setDogId }}>{children}</DogContext.Provider>;
}
export const useDog = () => useContext(DogContext);
