import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Profile } from '../types';
import { authFetch, setAuthToken, setLoggedOutFlag, isLoggedOut } from '../services/api';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  switchDemo: (target: 'user-a' | 'user-b') => Promise<void>;
  toggle2FA: () => Promise<boolean>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCurrentUser = async () => {
    try {
      setLoading(true);

      // Check URL query parameters for Google OAuth callback token or error
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const urlToken = urlParams.get('token');
        const authError = urlParams.get('auth_error');

        if (authError) {
          setError(decodeURIComponent(authError));
          const cleanUrl = window.location.pathname;
          window.history.replaceState({}, document.title, cleanUrl);
        }

        if (urlToken) {
          setAuthToken(urlToken);
          setLoggedOutFlag(false);
          const cleanUrl = window.location.pathname;
          window.history.replaceState({}, document.title, cleanUrl);
        }
      }

      // If user deliberately logged out previously, keep them at login screen
      if (isLoggedOut()) {
        setUser(null);
        setProfile(null);
        return;
      }

      const res = await authFetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setProfile(data.profile);
        if (data.token) {
          setAuthToken(data.token);
        }
      } else {
        // Fallback for first-time direct visitor (not logged out)
        const demoRes = await authFetch('/api/auth/switch-demo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target: 'user-a' })
        });
        if (demoRes.ok) {
          const demoData = await demoRes.json();
          setUser(demoData.user);
          setProfile(demoData.profile);
          if (demoData.token) {
            setAuthToken(demoData.token);
          }
        } else {
          setUser(null);
          setProfile(null);
        }
      }
    } catch (err) {
      console.error('Failed to fetch user:', err);
      setUser(null);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const login = async (email: string, password: string) => {
    setError(null);
    const res = await authFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to authenticate');
    }
    if (data.token) {
      setAuthToken(data.token);
    }
    setUser(data.user);
    setProfile(data.profile);
  };

  const signup = async (email: string, password: string, fullName: string) => {
    setError(null);
    const res = await authFetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, full_name: fullName })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to sign up');
    }
    if (data.token) {
      setAuthToken(data.token);
    }
    setUser(data.user);
    setProfile(data.profile);
  };

  const logout = async () => {
    try {
      await authFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors on logout
    } finally {
      setLoggedOutFlag(true);
      setUser(null);
      setProfile(null);
    }
  };

  const switchDemo = async (target: 'user-a' | 'user-b') => {
    setLoading(true);
    try {
      const res = await authFetch('/api/auth/switch-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target })
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setProfile(data.profile);
        if (data.token) {
          setAuthToken(data.token);
        }
      }
    } catch (err) {
      console.error('Failed demo switch:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggle2FA = async (): Promise<boolean> => {
    const res = await authFetch('/api/security/toggle-2fa', { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      if (profile) {
        setProfile({ ...profile, two_factor_enabled: data.two_factor_enabled });
      }
      return data.two_factor_enabled;
    }
    return false;
  };

  const refreshUser = async () => {
    await fetchCurrentUser();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        error,
        login,
        signup,
        logout,
        refreshUser,
        switchDemo,
        toggle2FA,
        clearError: () => setError(null)
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
