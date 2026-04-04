/**
 * Unit tests for ClerkAuthAdapter
 *
 * Tests the role normalisation logic without requiring a live Clerk instance.
 * The Clerk hooks are mocked so this test is fully isolated.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the @clerk/react module before importing anything that uses it
vi.mock('@clerk/react', () => ({
  useUser: vi.fn(),
  SignInButton: ({ children }: any) => children,
  UserButton: () => null,
}));

import { useUser } from '@clerk/react';
import { ClerkAuthAdapter } from '../ClerkAuthAdapter';

const mockUseUser = useUser as ReturnType<typeof vi.fn>;

describe('ClerkAuthAdapter.useAuthUser', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns { user: null, isLoaded: false } while Clerk is loading', () => {
    mockUseUser.mockReturnValue({ user: null, isLoaded: false });

    const { user, isLoaded } = ClerkAuthAdapter.useAuthUser();

    expect(user).toBeNull();
    expect(isLoaded).toBe(false);
  });

  it('returns { user: null, isLoaded: true } when no user is signed in', () => {
    mockUseUser.mockReturnValue({ user: null, isLoaded: true });

    const { user, isLoaded } = ClerkAuthAdapter.useAuthUser();

    expect(user).toBeNull();
    expect(isLoaded).toBe(true);
  });

  it('normalises a standard user with no admin role', () => {
    mockUseUser.mockReturnValue({
      user: {
        id: 'user_abc',
        primaryEmailAddress: { emailAddress: 'test@example.com' },
        publicMetadata: { role: 'customer' },
      },
      isLoaded: true,
    });

    const { user, isLoaded } = ClerkAuthAdapter.useAuthUser();

    expect(isLoaded).toBe(true);
    expect(user).not.toBeNull();
    expect(user!.id).toBe('user_abc');
    expect(user!.email).toBe('test@example.com');
    expect(user!.roles).toEqual([]); // no 'admin' role
  });

  it('adds "admin" to roles when publicMetadata.role === "admin"', () => {
    mockUseUser.mockReturnValue({
      user: {
        id: 'user_admin',
        primaryEmailAddress: { emailAddress: 'admin@rybform.com' },
        publicMetadata: { role: 'admin' },
      },
      isLoaded: true,
    });

    const { user } = ClerkAuthAdapter.useAuthUser();

    expect(user!.roles).toContain('admin');
  });

  it('handles a user with no primary email gracefully', () => {
    mockUseUser.mockReturnValue({
      user: {
        id: 'user_noemail',
        primaryEmailAddress: null,
        publicMetadata: {},
      },
      isLoaded: true,
    });

    const { user } = ClerkAuthAdapter.useAuthUser();

    expect(user!.email).toBeNull();
  });
});
