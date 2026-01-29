import React, { createContext, useContext, useState, useCallback } from 'react';

export type ToastType = 'info' | 'success' | 'error' | 'loading' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  showToast: (message: string, type?: ToastType, duration?: number) => string;
  dismissToast: (id: string) => void;
  updateToast: (id: string, message: string, type: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info', duration = 5000): string => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const toast: Toast = { id, message, type, duration };
    
    setToasts((prev) => [...prev, toast]);

    // Auto-dismiss after duration (unless it's a loading toast)
    if (type !== 'loading' && duration > 0) {
      setTimeout(() => {
        dismissToast(id);
      }, duration);
    }

    return id;
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const updateToast = useCallback((id: string, message: string, type: ToastType) => {
    setToasts((prev) =>
      prev.map((toast) =>
        toast.id === id
          ? { ...toast, message, type, duration: type === 'loading' ? 0 : toast.duration }
          : toast
      )
    );

    // Auto-dismiss if converting from loading to success/error
    const toast = toasts.find((t) => t.id === id);
    if (toast && type !== 'loading') {
      const duration = toast.duration || 5000;
      setTimeout(() => {
        dismissToast(id);
      }, duration);
    }
  }, [toasts, dismissToast]);

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast, updateToast }}>
      {children}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
