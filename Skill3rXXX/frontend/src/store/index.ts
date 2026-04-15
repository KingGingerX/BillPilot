/**
 * Zustand global state stores.
 * Auth state is persisted to localStorage so the user stays logged in
 * across page refreshes.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

// ── Auth Store ────────────────────────────────────────────────

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isEmailVerified: boolean;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  login(user: User, accessToken: string, refreshToken: string): void;
  logout(): void;
  updateTokens(accessToken: string, refreshToken: string): void;
  updateUser(user: Partial<User>): void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      login(user, accessToken, refreshToken) {
        set({ user, accessToken, refreshToken, isAuthenticated: true });
      },

      logout() {
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
      },

      updateTokens(accessToken, refreshToken) {
        set({ accessToken, refreshToken });
      },

      updateUser(partial) {
        set((s) => ({ user: s.user ? { ...s.user, ...partial } : null }));
      },
    }),
    {
      name: "pims-auth",
      // Only persist non-sensitive fields; tokens are stored here for convenience
      // but in a stricter security model you'd use httpOnly cookies
      partialize: (s) => ({
        user: s.user,
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
        isAuthenticated: s.isAuthenticated,
      }),
    }
  )
);

// ── UI Store ──────────────────────────────────────────────────

interface UiState {
  sidebarOpen: boolean;
  setSidebarOpen(open: boolean): void;
  toggleSidebar(): void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}));
