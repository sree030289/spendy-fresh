import { useState } from 'react';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    // Simulate login
    setTimeout(() => {
      setUser({ email });
      setIsLoading(false);
    }, 1000);
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    register: () => {},
    logout: () => setUser(null),
    updateUser: () => {},
  };
};