'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaCheckCircle, FaTimesCircle, FaInfoCircle } from 'react-icons/fa';

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
    <div className="fixed bottom-4 right-4 z-50 max-w-md">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 400, y: 20 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: 400 }}
            className={`mb-3 p-4 rounded-lg flex items-center gap-3 text-white shadow-lg backdrop-blur-sm ${
              toast.type === 'success' ? 'bg-neon-green/90' :
              toast.type === 'error' ? 'bg-neon-red/90' :
              'bg-neon-cyan/90'
            }`}
          >
            {toast.type === 'success' && <FaCheckCircle className="text-lg shrink-0" />}
            {toast.type === 'error' && <FaTimesCircle className="text-lg shrink-0" />}
            {toast.type === 'info' && <FaInfoCircle className="text-lg shrink-0" />}
            <span className="flex-1">{toast.message}</span>
            <button
              onClick={() => removeToastFromUI(toast.id)}
              className="text-white hover:opacity-70"
            >
              ✕
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
