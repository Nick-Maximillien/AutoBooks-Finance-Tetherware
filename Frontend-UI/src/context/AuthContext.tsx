'use client';
import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { getTokensFromLocalStorage, setTokensInLocalStorage } from '@utils/tokenUtils';

// Make sure to add this to your .env.local file (e.g., NEXT_PUBLIC_DJANGO_API_URL=http://localhost:8000)
const DJANGO_API_URL = process.env.NEXT_PUBLIC_DJANGO_API_URL || 'http://localhost:8000';

interface AuthContextType {
  accessToken: string | null;
  refreshToken: string | null;
  loading: boolean;
  error: string | null;
  setTokens: (access: string | null, refresh: string | null) => void;
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (userData: { username: string; email: string; password: string; [key: string]: any }) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load tokens on mount
  useEffect(() => {
    const { accessToken, refreshToken } = getTokensFromLocalStorage();
    setAccessToken(accessToken);
    setRefreshToken(refreshToken);
  }, []);

  const setTokens = (access: string | null, refresh: string | null) => {
    setTokensInLocalStorage(access, refresh);
    setAccessToken(access);
    setRefreshToken(refresh);
  };

  // --- SIGN IN FLOW ---
  const signIn = async (username: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${DJANGO_API_URL}/users/token/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) throw new Error('Invalid credentials');
      
      const data = await res.json();
      setTokens(data.access, data.refresh);
    } catch (err: any) {
      setError(err.message || 'Login failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (userData: { username: string; email: string; password: string; [key: string]: any }) => {
    setLoading(true);
    setError(null);
    try {
      // 1. Django creates the user -> fires signal -> creates BusinessProfile
      // 2. Django returns the JWT access and refresh tokens directly!
      const res = await fetch(`${DJANGO_API_URL}/users/signup/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });
      
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(JSON.stringify(errData) || 'Signup failed');
      }
      
      const data = await res.json();
      
      // Successfully signed up and logged in simultaneously
      setTokens(data.access, data.refresh);
    } catch (err: any) {
      setError(err.message || 'Signup failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // --- SIGN OUT FLOW ---
  const signOut = () => {
    setTokens(null, null);
  };

  return (
    <AuthContext.Provider value={{ 
      accessToken, 
      refreshToken, 
      loading, 
      error, 
      setTokens, 
      signIn, 
      signUp, 
      signOut 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};