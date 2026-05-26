"use client";
import { create } from "zustand";

interface AuthState {
  isLoggedIn: boolean;
  token: string | null;
  login: (token: string) => void;
  logout: () => void;
  initialize: () => void;
}

const TOKEN_KEY = "adpilot_token";

function setAuthCookie(token: string) {
  // Mirror to cookie so Next.js middleware can read it at edge
  document.cookie = `${TOKEN_KEY}=${token}; path=/; SameSite=Lax; Max-Age=86400`;
}

function clearAuthCookie() {
  document.cookie = `${TOKEN_KEY}=; path=/; SameSite=Lax; Max-Age=0`;
}

export const useAuthStore = create<AuthState>((set) => ({
  isLoggedIn: false,
  token: null,

  login: (token: string) => {
    localStorage.setItem(TOKEN_KEY, token);
    setAuthCookie(token);
    set({ isLoggedIn: true, token });
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    clearAuthCookie();
    set({ isLoggedIn: false, token: null });
  },

  initialize: () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      setAuthCookie(token); // refresh cookie
      set({ isLoggedIn: true, token });
    }
  },
}));
