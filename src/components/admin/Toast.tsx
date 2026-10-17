'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaCheckCircle, FaTimesCircle, FaInfoCircle, FaTimes } from 'react-icons/fa';

interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  duration?: number;
}

interface ToastContextType {
  toasts: ToastMessage[];
  addToast: (type: 'success' | 'error' | 'info', message: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

let toastId = 0;
let toastListeners: ((toasts: ToastMessage[]) => void)[] = [];
let currentToasts: ToastMessage[] = [];

export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>(currentToasts);

  const addToast = useCallback((type: 'success' | 'error' | 'info', message: string, duration: number = 3000) => {
    const id = `toast-${++toastId}`;
    const newToast: ToastMessage = { id, type, message, duration };
    
    currentToasts = [...currentToasts, newToast];
    toastListeners.forEach(listener => listener([...currentToasts]));

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    currentToasts = currentToasts.filter(t => t.id !== id);
    toastListeners.forEach(listener => listener([...currentToasts]));
  }, []);

  // Register this hook's setter ONCE with useEffect
  useEffect(() => {
    if (!toastListeners.includes(setToasts)) {
      toastListeners.push(setToasts);
    }
    
    return () => {
      const index = toastListeners.indexOf(setToasts);
      if (index > -1) {
        toastListeners.splice(index, 1);
      }
    };
  }, []);

  return { addToast, removeToast };
}

export function Toast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Register for updates
  const removeToastFromUI = (id: string) => {
    setToasts(t => t.filter(toast => toast.id !== id));
  };

  // Subscribe to global toast updates ONCE with useEffect
  useEffect(() => {
    const handleToastUpdate = (newToasts: ToastMessage[]) => {
      setToasts(newToasts);
    };

    if (!toastListeners.includes(handleToastUpdate)) {
      toastListeners.push(handleToastUpdate);
    }

    return () => {
      const index = toastListeners.indexOf(handleToastUpdate);
      if (index > -1) {
        toastListeners.splice(index, 1);
      }
    };
  }, []);

  return (
    <div
      className="fixed bottom-4 right-4 z-[70] w-[min(24rem,calc(100vw-2rem))] space-y-2"
      aria-live="polite"
      aria-label="Notifications"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            role={toast.type === 'error' ? 'alert' : 'status'}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="flex items-start gap-3 rounded-xl border border-dark-border bg-dark-lighter p-3 pr-2 text-sm text-text-primary shadow-[0_8px_24px_rgb(0_0_0/0.35)]"
          >
            <span className="pt-0.5 text-base shrink-0" aria-hidden="true">
              {toast.type === 'success' && <FaCheckCircle className="text-green-400" />}
              {toast.type === 'error' && <FaTimesCircle className="text-red-400" />}
              {toast.type === 'info' && <FaInfoCircle className="text-cyber-cyan" />}
            </span>
            <span className="flex-1 pt-px leading-5">{toast.message}</span>
            <button
              type="button"
              onClick={() => removeToastFromUI(toast.id)}
              aria-label="Dismiss notification"
              className="grid place-items-center w-7 h-7 shrink-0 rounded-md text-text-muted hover:text-text-primary hover:bg-dark-card transition-colors"
            >
              <FaTimes className="text-xs" aria-hidden="true" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
