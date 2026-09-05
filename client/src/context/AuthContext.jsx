import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { fetchCurrentUser, signIn as apiSignIn, signUp as apiSignUp, storeToken, getStoredToken } from '../api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = getStoredToken();

    if (!token) {
      setReady(true);
      return;
    }

    fetchCurrentUser()
      .then((data) => setUser(data.user))
      .catch(() => {
        storeToken(null);
        setUser(null);
      })
      .finally(() => setReady(true));
  }, []);

  async function completeAuth(data) {
    storeToken(data.token);
    setUser(data.user);
    return data.user;
  }

  const value = useMemo(
    () => ({
      user,
      ready,
      async signup(username, email, password) {
        return completeAuth(await apiSignUp(username, email, password));
      },
      async signin(email, password) {
        return completeAuth(await apiSignIn(email, password));
      },
      signout() {
        storeToken(null);
        setUser(null);
      },
    }),
    [user, ready]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
