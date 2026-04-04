import type { ReactNode, ComponentType } from 'react';

export interface AuthUser {
  id: string;
  email: string | null;
  roles: string[];
}

export interface IAuthService {
  /** Hook to get the current authenticated user's normalized state */
  useAuthUser(): { user: AuthUser | null; isLoaded: boolean };
  
  /** 
   * A Guard wrapper that protects child components. 
   * Provides a unified way to do RBAC layout rendering without exposing Vendor components.
   */
  Guard: React.FC<{ children: ReactNode; role?: string; fallback?: ReactNode }>;

  // Vendor-agnostic UI Components
  SignInButton: ComponentType<{ fallbackRedirectUrl?: string; mode?: 'modal' | 'redirect'; children?: ReactNode }>;
  UserButton: ComponentType;
}
