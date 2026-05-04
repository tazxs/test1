import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  type: ToastType
  message: string
  description?: string
  duration?: number
}

interface NotificationState {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
  clearAll: () => void
}

export const useNotificationStore = create<NotificationState>((set) => ({
  toasts: [],

  addToast: (toast) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }))
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }))
  },

  clearAll: () => set({ toasts: [] }),
}))

/** Convenience helpers — call these anywhere without hooks */
export const toast = {
  success: (message: string, description?: string) =>
    useNotificationStore.getState().addToast({ type: 'success', message, description }),
  error: (message: string, description?: string) =>
    useNotificationStore.getState().addToast({ type: 'error', message, description }),
  warning: (message: string, description?: string) =>
    useNotificationStore.getState().addToast({ type: 'warning', message, description }),
  info: (message: string, description?: string) =>
    useNotificationStore.getState().addToast({ type: 'info', message, description }),
}
