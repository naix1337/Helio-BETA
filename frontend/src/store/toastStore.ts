// helio-app/frontend/src/store/toastStore.ts
import { create } from 'zustand';
import type { AlertFireEvent } from '../types.ts';

export interface Toast {
  id: number;
  event: AlertFireEvent;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (event: AlertFireEvent) => void;
  removeToast: (id: number) => void;
}

let nextId = 0;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],

  addToast: (event) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { id, event }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter(t => t.id !== id) })), 6000);
  },

  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}));
