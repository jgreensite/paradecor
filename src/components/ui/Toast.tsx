import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`
              pointer-events-auto min-w-[300px] p-4 rounded-xl shadow-2xl 
              backdrop-blur-md border animate-in fade-in slide-in-from-right-4 duration-300
              flex items-center justify-between
              ${toast.type === 'success' ? 'bg-emerald-500/90 border-emerald-400 text-white' : ''}
              ${toast.type === 'error' ? 'bg-rose-500/90 border-rose-400 text-white' : ''}
              ${toast.type === 'info' ? 'bg-blue-500/90 border-blue-400 text-white' : ''}
              ${toast.type === 'warning' ? 'bg-amber-500/90 border-amber-400 text-white' : ''}
            `}
          >
            <div className="flex items-center gap-3">
              {toast.type === 'success' && <span>✅</span>}
              {toast.type === 'error' && <span>❌</span>}
              {toast.type === 'info' && <span>ℹ️</span>}
              <p className="text-sm font-medium">{toast.message}</p>
            </div>
            <button 
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              className="ml-4 hover:opacity-70 transition-opacity"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
