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
const ADMIN_PASSWORD_KEY = "sales_catalog_admin_password";
const USER_CREDS_KEY = "sales_catalog_users_v2";

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

// Hardcoded admin credentials (password can be overridden via localStorage)
export const ADMIN_USER: AuthUser & { password: string } = {
  id: "admin-001",
  email: "admin@admin.com",
  password: "Admin123",
  name: "Admin User",
  role: "admin",
};

// Load persisted password override at startup
const persistedPassword = localStorage.getItem(ADMIN_PASSWORD_KEY);
if (persistedPassword) {
  ADMIN_USER.password = persistedPassword;
}

/**
 * Change the admin password. Verifies the current password first.
 * Returns an error string or null on success.
 */
export function changeAdminPassword(
  currentPassword: string,
  newPassword: string,
): string | null {
  if (currentPassword !== ADMIN_USER.password) {
    return "wrong";
  }
  if (newPassword.length < 6) {
    return "short";
  }
  ADMIN_USER.password = newPassword;
  localStorage.setItem(ADMIN_PASSWORD_KEY, newPassword);
  return null;
}

// ── Per-user credential system ────────────────────────────────────────────────

interface UserCred {
  password: string;
  mustChange: boolean;
}

type UserCredMap = Record<string, UserCred>; // keyed by email

function loadUserCreds(): UserCredMap {
  try {
    const raw = localStorage.getItem(USER_CREDS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as UserCredMap;
  } catch {
    return {};
  }
}

function saveUserCreds(map: UserCredMap): void {
  localStorage.setItem(USER_CREDS_KEY, JSON.stringify(map));
}

/**
 * Set (or overwrite) the password for a user.
 * mustChange = true means they'll be prompted to change on next login.
 */
export function setUserPassword(
  email: string,
  password: string,
  mustChange: boolean,
): void {
  const map = loadUserCreds();
  map[email] = { password, mustChange };
  saveUserCreds(map);
}

/**
 * Get the credential record for an email, or undefined if not set.
 */
export function getUserCred(email: string): UserCred | undefined {
  return loadUserCreds()[email];
}

/**
 * Change a non-admin user's password.
 * Returns "wrong" | "short" on failure, or null on success.
 */
export function changeUserPassword(
  email: string,
  currentPassword: string,
  newPassword: string,
): "wrong" | "short" | null {
  const map = loadUserCreds();
  const cred = map[email];
  if (!cred || cred.password !== currentPassword) {
    return "wrong";
  }
  if (newPassword.length < 6) {
    return "short";
  }
  map[email] = { password: newPassword, mustChange: false };
  saveUserCreds(map);
  return null;
}
