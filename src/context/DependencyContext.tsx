import React, { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from 'react';
import { useAuth } from '@clerk/react';
import { createSupabaseDatabaseAdapter } from '../infrastructure/adapters/SupabaseDatabaseAdapter';
import { createAuthenticatedClient, supabase as publicSupabase } from '../infrastructure/config/supabase';
import type { IAuthService } from '../core/ports/IAuthService';
import type { IDatabaseService } from '../core/ports/IDatabaseService';
import type { IPaymentService } from '../core/ports/IPaymentService';

export interface Dependencies {
  auth: IAuthService;
  db: IDatabaseService;
  payment: IPaymentService;
}

const NullDatabaseAdapter: IDatabaseService = {
  saveOrder: async () => { throw new Error('Database not initialized'); },
  fetchOrders: async () => { throw new Error('Database not initialized'); }
};

const DependencyContext = createContext<Dependencies | null>(null);

export const DependencyProvider = ({ 
  children, 
  initialDependencies 
}: { 
  children: ReactNode; 
  initialDependencies: Omit<Dependencies, 'db'>; 
}) => {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [dbService, setDbService] = useState<IDatabaseService>(() => 
    publicSupabase ? createSupabaseDatabaseAdapter(publicSupabase) : NullDatabaseAdapter
  );

  useEffect(() => {
    let isMounted = true;

    async function syncAuth() {
      if (!isLoaded) return;
      
      try {
        if (isSignedIn) {
          // Get the Supabase-specific JWT from Clerk
          const token = await getToken({ template: 'supabase' });
          if (token && isMounted) {
            const authClient = createAuthenticatedClient(token);
            setDbService(createSupabaseDatabaseAdapter(authClient));
          }
        } else if (isMounted) {
          // Fallback to anonymous client
          setDbService(publicSupabase ? createSupabaseDatabaseAdapter(publicSupabase) : NullDatabaseAdapter);
        }
      } catch (err) {
        console.error('Failed to sync Supabase auth:', err);
      }
    }

    syncAuth();
    return () => { isMounted = false; };
  }, [isLoaded, isSignedIn, getToken]);

  const value = useMemo(() => ({
    ...initialDependencies,
    db: dbService
  }), [initialDependencies, dbService]);

  return (
    <DependencyContext.Provider value={value}>
      {children}
    </DependencyContext.Provider>
  );
};

export const useDependencies = () => {
  const context = useContext(DependencyContext);
  if (!context) {
    throw new Error('useDependencies must be used within a DependencyProvider');
  }
  return context;
};
