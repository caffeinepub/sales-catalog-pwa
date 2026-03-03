import { create } from "zustand";

export type UserRole = "admin" | "sales_rep";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

interface AuthState {
  currentUser: AuthUser | null;
  isAuthenticated: boolean;
  login: (user: AuthUser) => void;
  logout: () => void;
}

const SESSION_KEY = "sales_catalog_session";

// Load from localStorage on init
function loadSession(): AuthUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  currentUser: loadSession(),
  isAuthenticated: !!loadSession(),

  login: (user: AuthUser) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    set({ currentUser: user, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem(SESSION_KEY);
    set({ currentUser: null, isAuthenticated: false });
  },
}));

// Hardcoded admin credentials
export const ADMIN_USER: AuthUser & { password: string } = {
  id: "admin-001",
  email: "admin@admin.com",
  password: "Admin123",
  name: "Admin User",
  role: "admin",
};
