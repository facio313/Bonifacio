import { create } from 'zustand'
import type { App } from '../types/app'

interface StoreState {
  selectedApp: App | null
  openApp: (app: App) => void
  closeApp: () => void
}

export const useStore = create<StoreState>((set) => ({
  selectedApp: null,
  openApp: (app) => set({ selectedApp: app }),
  closeApp: () => set({ selectedApp: null }),
}))
