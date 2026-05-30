import { getToken } from 'next-auth/jwt';
import { NextRequest } from 'next/server';
import { getAuthSecret } from './secret';

export interface AuthToken {
  email?: string;
  role?: string;
  name?: string;
  mfa_verified?: boolean;
}

export async function checkAuth(
  request: NextRequest,
  requiredRoles?: string[]
): Promise<AuthToken | null> {
  try {
    const token = await getToken({
      req: request,
      secret: getAuthSecret(),
    });

    if (!token) {
      return null;
    }

    const authToken: AuthToken = {
      email: token.email as string,
      role: token.role as string,
      name: token.name as string,
      mfa_verified: token.mfa_verified as boolean,
    };

    // Check if user has required role
    if (requiredRoles && !requiredRoles.includes(authToken.role || '')) {
      return null;
    }

    // Check if MFA is verified
    if (!authToken.mfa_verified) {
      return null;
    }

    return authToken;
  } catch (error) {
    console.error('Auth check error:', error);
    return null;
  }
}
