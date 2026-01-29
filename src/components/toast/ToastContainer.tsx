import React from 'react';
import { useToast } from '../../contexts/ToastContext';
import './ToastContainer.css';

const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useToast();

  const getToastIcon = (type: string) => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'loading':
        return '⟳';
      default:
        return 'ℹ';
    }
  };

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          <div className="toast-icon">
            {getToastIcon(toast.type)}
          </div>
          <div className="toast-message">{toast.message}</div>
          {toast.type !== 'loading' && (
            <button
              className="toast-dismiss"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss"
            >
              ✕
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
