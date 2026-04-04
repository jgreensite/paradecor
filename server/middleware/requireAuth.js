import { createClerkClient } from '@clerk/backend';

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

/**
 * Middleware to verify Clerk JWT and attach user info to the request.
 * Required for all sensitive backend routes.
 */
export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split(' ')[1];
    
    // Verify the session token
    // Note: sessionClaims will contain the user ID (sub)
    const session = await clerkClient.verifyToken(token);
    
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }

    // Attach user ID to request for downstream use (e.g. Supabase RLS)
    req.auth = {
      userId: session.sub,
      token: token
    };

    next();
  } catch (error) {
    console.error('Auth Middleware Error:', error.message);
    return res.status(401).json({ error: 'Unauthorized: Authentication failed' });
  }
};
