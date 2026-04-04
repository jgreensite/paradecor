import React from 'react';
import type { ReactNode } from 'react';
import { useUser, SignInButton, UserButton } from '@clerk/react';
import type { IAuthService, AuthUser } from '../../core/ports/IAuthService';

export const ClerkAuthAdapter: IAuthService = {
  useAuthUser: () => {
    const { user, isLoaded } = useUser();
    
    if (!isLoaded) {
      return { user: null, isLoaded: false };
    }
    if (!user) {
      return { user: null, isLoaded: true };
    }

    const roles: string[] = [];
    if (user.publicMetadata?.role === 'admin') {
      roles.push('admin');
    }

    const authUser: AuthUser = {
      id: user.id,
      email: user.primaryEmailAddress?.emailAddress || null,
      roles: roles
    };

    return { user: authUser, isLoaded: true };
  },

  Guard: ({ children, role, fallback = null }: { children: ReactNode; role?: string; fallback?: ReactNode }) => {
    const { user, isLoaded } = useUser();

    if (!isLoaded) return null;
    if (!user) return <>{fallback}</>;

    if (role && user.publicMetadata?.role !== role) {
      return <>{fallback}</>;
    }

    return <>{children}</>;
  },

  SignInButton: ({ fallbackRedirectUrl, children }) => (
    <SignInButton mode="modal" fallbackRedirectUrl={fallbackRedirectUrl}>
      {children}
    </SignInButton>
  ),
  
  UserButton: () => <UserButton />
};
