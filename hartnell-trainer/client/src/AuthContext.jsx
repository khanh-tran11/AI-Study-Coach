import { createContext, useContext, useState, useCallback } from 'react';
import { loginUser, logoutUser } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('ht_user')); } catch { return null; }
  });

  const login = useCallback(async (email, password) => {
    const { data } = await loginUser(email, password);
    sessionStorage.setItem('ht_user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try { await logoutUser(); } catch { /* ignore */ }
    sessionStorage.removeItem('ht_user');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
