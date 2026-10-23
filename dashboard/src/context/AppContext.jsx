import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { api } from '../lib/api';

// ---- Auth ----------------------------------------------------------------

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading, null = signed out
  const initialCheckDone = useRef(false);

  const refresh = useCallback(async () => {
    const isUnlocked = typeof window !== 'undefined' && sessionStorage.getItem('apex_session_unlocked') === 'true';
    if (!isUnlocked) {
      if (!initialCheckDone.current) {
        initialCheckDone.current = true;
        api('/auth/logout', { method: 'POST' }).catch(() => {});
      }
      setUser(null);
      return null;
    }
    initialCheckDone.current = true;
    try {
      const { user: u } = await api('/auth/me');
      if (!u) {
        sessionStorage.removeItem('apex_session_unlocked');
      }
      setUser(u || null);
      return u || null;
    } catch {
      sessionStorage.removeItem('apex_session_unlocked');
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (loginVal, passwordVal) => {
    const { user } = await api('/auth/login', { method: 'POST', body: { login: loginVal, password: passwordVal } });
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('apex_session_unlocked', 'true');
    }
    setUser(user);
    return user;
  };
  const register = async (data) => {
    const { user } = await api('/auth/register', { method: 'POST', body: data });
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('apex_session_unlocked', 'true');
    }
    setUser(user);
    return user;
  };
  const logout = async () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('apex_session_unlocked');
    }
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, setUser, refresh, login, register, logout }}>{children}</AuthContext.Provider>;
}

// ---- Toasts --------------------------------------------------------------

const ToastContext = createContext(null);
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const id = useRef(0);

  const push = useCallback((type, message) => {
    const tid = ++id.current;
    setToasts((t) => [...t, { id: tid, type, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== tid)), 4500);
  }, []);

  const toast = useRef({
    success: (m) => push('success', m),
    error: (m) => push('error', m instanceof Error ? m.message : m),
  }).current;

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="no-print pointer-events-none fixed right-4 bottom-4 z-[100] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40 }}
              className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-3.5 text-sm shadow-2xl backdrop-blur ${
                t.type === 'success' ? 'border-green-500/30 bg-ink-800/95 text-green-200' : 'border-rose-500/30 bg-ink-800/95 text-rose-200'
              }`}
            >
              {t.type === 'success' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-400" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />}
              <span className="flex-1">{t.message}</span>
              <button onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} className="text-zinc-500 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

// ---- Data hook -------------------------------------------------------------

/** Loads `path` on mount (and whenever deps change). Returns { data, loading, error, reload }. */
export function useApi(path, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const load = useCallback(async () => {
    if (!path) return;
    setState((s) => ({ ...s, loading: true }));
    try {
      const data = await api(path);
      setState({ data, loading: false, error: null });
    } catch (error) {
      setState({ data: null, loading: false, error });
    }
  }, [path]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    load();
  }, [load, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  return { ...state, reload: load };
}
