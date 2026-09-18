import React, { createContext, useContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import client from '../api/client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem('token') || localStorage.getItem('access_token'));
  const [role, setRole] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize auth state from stored token
  useEffect(() => {
    const activeToken = localStorage.getItem('token') || localStorage.getItem('access_token');
    if (activeToken) {
      try {
        const decoded = jwtDecode(activeToken);
        const currentTime = Date.now() / 1000;
        if (decoded.exp && decoded.exp < currentTime) {
          // Token has expired
          logout();
        } else {
          setToken(activeToken);
          setUserId(decoded.sub || null);
          setRole(decoded.role || null);
        }
      } catch (err) {
        console.error('Invalid or corrupt stored token:', err);
        logout();
      }
    } else {
      setToken(null);
      setUserId(null);
      setRole(null);
    }
    setIsLoading(false);
  }, []);

  const login = async (email, password) => {
    // FastAPI OAuth2PasswordRequestForm expects URL-encoded form data (username, password)
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);

    const response = await client.post('/auth/login', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const { access_token, role: responseRole } = response.data;
    if (access_token) {
      localStorage.setItem('token', access_token);
      localStorage.setItem('access_token', access_token);
      setToken(access_token);

      try {
        const decoded = jwtDecode(access_token);
        setUserId(decoded.sub || null);
        setRole(decoded.role || responseRole);
      } catch (err) {
        console.warn('Could not decode token payload:', err);
        setRole(responseRole);
      }

      return { success: true, data: response.data };
    }
    throw new Error('No access token received from authentication server');
  };

  const register = async (name, email, password, role) => {
    const payload = { name, email, password, role };
    const response = await client.post('/auth/register', payload);
    return response.data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('access_token');
    setToken(null);
    setRole(null);
    setUserId(null);
  };

  const isAuthenticated = Boolean(token);

  const value = {
    token,
    role,
    userId,
    isAuthenticated,
    isLoading,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
