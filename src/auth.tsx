import React from 'react';
import type { ReactNode } from 'react';
import { useDependencies } from './context/DependencyContext';

export const AdminGuard = ({ children, fallback = null }: { children: ReactNode, fallback?: ReactNode }) => {
  const { auth } = useDependencies();
  const { user, isLoaded } = auth.useAuthUser();
  
  // Loading state handling, could enhance later if needed
  if (!isLoaded) return null;
  
  const isAdmin = user?.roles.includes('admin') ?? false;
  
  return isAdmin ? <>{children}</> : <>{fallback}</>;
};

export const CustomerGuard = ({ children, fallback = null }: { children: ReactNode, fallback?: ReactNode }) => {
  const { auth } = useDependencies();
  const { user, isLoaded } = auth.useAuthUser();
  
  if (!isLoaded) return null;
  
  const isAdmin = user?.roles.includes('admin') ?? false;
  
  // Customers/Guests are non-admins.
  return !isAdmin ? <>{children}</> : <>{fallback}</>;
};
