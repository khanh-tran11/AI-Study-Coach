import { createContext, useContext, useState } from 'react';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [role, setRole] = useState(() => localStorage.getItem('userRole') || null);

  function login(newRole) {
    setRole(newRole);
    localStorage.setItem('userRole', newRole);
  }

  function logout() {
    setRole(null);
    localStorage.removeItem('userRole');
  }

  return (
    <AuthContext.Provider value={{ role, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
