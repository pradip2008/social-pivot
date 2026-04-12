'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';

interface Fan {
  id: string;
  name: string;
  email: string;
  profileImage: string | null;
}

interface FanAuthContextType {
  fan: Fan | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string, fan: Fan) => void;
  logout: () => void;
}

const FanAuthContext = createContext<FanAuthContextType | undefined>(undefined);

export function FanAuthProvider({ children }: { children: React.ReactNode }) {
  const [fan, setFan] = useState<Fan | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const storedToken = localStorage.getItem('fanToken');
    const storedFan = localStorage.getItem('fanData');

    if (storedToken && storedFan) {
      try {
        setToken(storedToken);
        setFan(JSON.parse(storedFan));
      } catch (e) {
        localStorage.removeItem('fanToken');
        localStorage.removeItem('fanData');
      }
    }
    setIsLoaded(true);
  }, []);

  const login = (newToken: string, newFan: Fan) => {
    setToken(newToken);
    setFan(newFan);
    localStorage.setItem('fanToken', newToken);
    localStorage.setItem('fanData', JSON.stringify(newFan));
  };

  const logout = () => {
    setToken(null);
    setFan(null);
    localStorage.removeItem('fanToken');
    localStorage.removeItem('fanData');
  };

  if (!isLoaded) return null; // Avoid hydration mismatch

  return (
    <FanAuthContext.Provider value={{ fan, token, isAuthenticated: !!token, login, logout }}>
      {children}
    </FanAuthContext.Provider>
  );
}

export function useFanAuth() {
  const context = useContext(FanAuthContext);
  if (context === undefined) {
    throw new Error('useFanAuth must be used within a FanAuthProvider');
  }
  return context;
}
