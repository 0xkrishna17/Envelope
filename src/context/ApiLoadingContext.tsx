import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface LoadingState {
  isLoading: boolean;
  message: string | null;
  progressPercent?: number;
}

interface ToastNotification {
  id: string;
  message: string;
  type: 'info' | 'success' | 'error';
  duration?: number;
}

interface ApiLoadingContextType {
  isLoading: boolean;
  loadingMessage: string | null;
  startApiCall: (message?: string | null) => () => void;
  setApiMessage: (message: string | null) => void;
  showToast: (message: string, type?: 'info' | 'success' | 'error') => void;
}

const ApiLoadingContext = createContext<ApiLoadingContextType | undefined>(undefined);

export const ApiLoadingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeCalls, setActiveCalls] = useState<number>(0);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  const startApiCall = useCallback((message?: string | null) => {
    setActiveCalls(prev => prev + 1);
    if (message) {
      setLoadingMessage(message);
    }

    let ended = false;
    return () => {
      if (!ended) {
        ended = true;
        setActiveCalls(prev => {
          const next = Math.max(0, prev - 1);
          if (next === 0) {
            setLoadingMessage(null);
          }
          return next;
        });
      }
    };
  }, []);

  const setApiMessage = useCallback((message: string | null) => {
    setLoadingMessage(message);
  }, []);

  const showToast = useCallback((message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const id = `${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    setToasts(prev => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3200);
  }, []);

  const isLoading = activeCalls > 0;

  return (
    <ApiLoadingContext.Provider
      value={{
        isLoading,
        loadingMessage,
        startApiCall,
        setApiMessage,
        showToast,
      }}
    >
      {/* Sleek Top Hairline Progress Bar */}
      {isLoading && (
        <div className="fixed top-0 left-0 right-0 z-100 pointer-events-none">
          <div className="h-1 w-full bg-transparent overflow-hidden">
            <div className="h-full bg-linear-to-r from-[#486B88] via-[#B85D43] to-[#4E785E] animate-shimmer w-full origin-left-right" />
          </div>
        </div>
      )}

      {/* Floating Status Pill for Active API Calls */}
      {isLoading && loadingMessage && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-90 pointer-events-none animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-[#1F1B16]/90 dark:bg-[#EDE8E1]/95 text-[#FAF7F2] dark:text-[#1A1714] text-xs font-medium shadow-xl backdrop-blur-md border border-white/10">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#B85D43] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#B85D43]" />
            </span>
            <span>{loadingMessage}</span>
          </div>
        </div>
      )}

      {/* Floating Toast Alerts */}
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-90 flex flex-col gap-2 pointer-events-none items-center">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`pointer-events-auto px-4 py-2 rounded-2xl text-xs font-semibold shadow-lg backdrop-blur-md border transition-all animate-in fade-in slide-in-from-bottom-3 duration-200 flex items-center gap-2 ${
              toast.type === 'success'
                ? 'bg-[#EBF2ED] text-[#2C523B] border-[#CADBCE] dark:bg-[#1E2E24] dark:text-[#A8D1B7] dark:border-[#2C4A36]'
                : toast.type === 'error'
                ? 'bg-[#F9ECE8] text-[#87341D] border-[#E8C5BC] dark:bg-[#331D16] dark:text-[#F3B3A2] dark:border-[#5E261B]'
                : 'bg-[#FAF7F2] text-[#1F1B16] border-[#DCD5C9] dark:bg-[#1A1714] dark:text-[#EDE8E1] dark:border-[#3D362F]'
            }`}
          >
            <span>{toast.message}</span>
          </div>
        ))}
      </div>

      {children}
    </ApiLoadingContext.Provider>
  );
};

export const useApiLoading = () => {
  const context = useContext(ApiLoadingContext);
  if (!context) {
    throw new Error('useApiLoading must be used within an ApiLoadingProvider');
  }
  return context;
};
