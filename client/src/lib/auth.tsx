import { createContext, useContext, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

interface User { id: number; email: string; name: string; }
interface AuthCtx { user: User | null; loading: boolean; refetch: () => void; }
const AuthContext = createContext<AuthCtx>({ user: null, loading: true, refetch: () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["me"],
    queryFn: () => api<User>("/api/auth/me").catch(() => null),
  });
  return <AuthContext.Provider value={{ user: data ?? null, loading: isLoading, refetch }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);

interface DogCtx { dogId: number | null; setDogId: (id: number) => void; }
const DogContext = createContext<DogCtx>({ dogId: null, setDogId: () => {} });
export function DogProvider({ children }: { children: ReactNode }) {
  const [dogId, setDogId] = useState<number | null>(null);
  return <DogContext.Provider value={{ dogId, setDogId }}>{children}</DogContext.Provider>;
}
export const useDog = () => useContext(DogContext);
