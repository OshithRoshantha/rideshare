import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Role = "passenger" | "driver" | "admin";

export interface SavedPlace {
  label: string;
  name: string;
  lat: number;
  lng: number;
}

export interface User {
  id: string;
  role: Role;
  full_name: string;
  email: string;
  phone: string;
  saved_places: SavedPlace[];
  wallet_balance_lkr: number;
  is_active: boolean;
}

interface AuthState {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  updateUser: (user: Partial<User>) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      updateUser: (patch) => set((s) => ({ user: s.user ? { ...s.user, ...patch } : s.user })),
      logout: () => set({ token: null, user: null }),
    }),
    { name: "rideshare-auth" },
  ),
);
