import { create } from 'zustand'
import type { App } from '../types/app'

interface StoreState {
  selectedApp: App | null
  isDark: boolean
  openApp: (app: App) => void
  closeApp: () => void
  toggleDark: () => void
  initDark: () => void
}

export const useStore = create<StoreState>((set) => ({
  selectedApp: null,
  isDark: false,
  openApp: (app) => set({ selectedApp: app }),
  closeApp: () => set({ selectedApp: null }),
  toggleDark: () =>
    set((state) => {
      const next = !state.isDark
      document.documentElement.classList.toggle('dark', next)
      return { isDark: next }
    }),
  initDark: () => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    document.documentElement.classList.toggle('dark', prefersDark)
    set({ isDark: prefersDark })
  },
}))
