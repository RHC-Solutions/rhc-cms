import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import {
  loadUsers,
  saveUsers,
  StoredUser,
} from './users';
import { verifyTotp } from './totp';
import {
  isIPBlocked,
  recordFailedAttempt,
  getBlockedIPInfo,
  cleanupExpiredBlocks,
} from './ip-blocker';
import { getAuthSecret } from './secret';
import { getSecret } from '@/lib/env';

async function sendTelegramNotification(email: string, success: boolean, reason?: string, ip?: string, city?: string, country?: string) {
  const botToken = getSecret('TELEGRAM_CONTACT_BOT_TOKEN');
  const chatId = getSecret('TELEGRAM_CONTACT_CHAT_ID');
  
  if (!botToken || !chatId) return;
  
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const timestamp = `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
  
  const status = success ? '✅ SUCCESS' : '❌ FAILED';
  const emoji = success ? '🔓' : '🔒';
  
  let message = `${emoji} <b>Login Attempt - ${status}</b>\n\n`;
  message += `📧 <b>Email:</b> ${email}\n`;
  message += `🕐 <b>Time:</b> ${timestamp}\n`;
  if (ip) {
    message += `🌐 <b>IP:</b> ${ip}`;
    if (city && country) {
      message += ` (${city}, ${country})`;
    } else if (country) {
      message += ` (${country})`;
    }
    message += `\n`;
  }
  if (reason) message += `📝 <b>Reason:</b> ${reason}\n`;
  message += `\n🔗 <b>Domain:</b> rhcsolutions.com`;
  
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
    });
  } catch (error) {
    console.error('[Telegram] Error:', error);
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'admin@rhcsolutions.com' },
        password: { label: 'Password', type: 'password' },
        totp: { label: 'TOTP Code', type: 'text', placeholder: '123456' },
      },
      async authorize(credentials, req) {
        // Derive IP from client payload or request headers
        const getHeader = (name: string) => {
          const headersObj: any = (req as any)?.headers;
          if (!headersObj) return undefined;
          if (typeof headersObj.get === 'function') return headersObj.get(name);
          return headersObj[name] || headersObj[name?.toLowerCase?.()];
        };

        const forwarded = getHeader('x-forwarded-for');
        const realIp = getHeader('x-real-ip');
        const cfIp = getHeader('cf-connecting-ip');

        const ip = (credentials as any)?.ip
          || forwarded?.split(',')[0]?.trim()
          || realIp
          || cfIp
          || 'unknown';
        
        const city = (credentials as any)?.city || 'Unknown';
        const country = (credentials as any)?.country || 'Unknown';

        // Clean up expired blocks
        cleanupExpiredBlocks();

        // Check if IP is blocked
        if (isIPBlocked(ip)) {
          const blockInfo = getBlockedIPInfo(ip);
          const hoursLeft = blockInfo?.hoursRemaining || 0;
          console.log(`[Auth] IP blocked: ${ip} (${hoursLeft} hours remaining)`);
          await sendTelegramNotification(
            credentials?.email || 'unknown',
            false,
            `IP blocked for brute force (${hoursLeft}h remaining)`,
            ip,
            city,
            country
          );
          return null;
        }
        
        if (!credentials?.email || !credentials?.password) {
          console.log('[Auth] Missing credentials');
          recordFailedAttempt(ip);
          await sendTelegramNotification(credentials?.email || 'unknown', false, 'Missing credentials', ip, city, country);
          return null;
        }

        const users = loadUsers();
        const userIndex = users.findIndex((u) => u.email.toLowerCase() === credentials.email.toLowerCase());
        const user = userIndex >= 0 ? users[userIndex] : undefined;
        if (!user) {
          console.log('[Auth] User not found:', credentials.email);
          const result = recordFailedAttempt(ip);
          await sendTelegramNotification(
            credentials.email,
            false,
            `User not found${result.isNowBlocked ? ' - IP BLOCKED' : ` (${result.attemptsLeft} attempts left)`}`,
            ip,
            city,
            country
          );
          return null;
        }

        if (user.status === 'disabled') {
          console.log('[Auth] User disabled:', user.email);
          const result = recordFailedAttempt(ip);
          await sendTelegramNotification(
            user.email,
            false,
            `Account disabled${result.isNowBlocked ? ' - IP BLOCKED' : ` (${result.attemptsLeft} attempts left)`}`,
            ip,
            city,
            country
          );
          return null;
        }

        const passwordHash = user.passwordHash;
        const isValid = passwordHash
          ? await bcrypt.compare(credentials.password, passwordHash)
          : false;

        if (!isValid) {
          console.log('[Auth] Invalid password for:', user.email);
          const result = recordFailedAttempt(ip);
          await sendTelegramNotification(
            user.email,
            false,
            `Invalid password${result.isNowBlocked ? ' - IP BLOCKED' : ` (${result.attemptsLeft} attempts left)`}`,
            ip,
            city,
            country
          );
          return null;
        }

        const totpCode = credentials.totp as string | undefined;
        if (user.totpEnabled) {
          const hasValidTotp = user.totpSecret ? verifyTotp(totpCode || '', user.totpSecret) : false;

          // Allow recovery code fallback
          const recoveryCodes = user.recoveryCodes || [];
          const usedRecovery = totpCode && recoveryCodes.includes(totpCode);

          if (!hasValidTotp && !usedRecovery) {
            console.log('[Auth] TOTP required/invalid for:', user.email);
            const result = recordFailedAttempt(ip);
            await sendTelegramNotification(
              user.email,
              false,
              `Invalid 2FA code${result.isNowBlocked ? ' - IP BLOCKED' : ` (${result.attemptsLeft} attempts left)`}`,
              ip,
              city,
              country
            );
            return null;
          }

          if (usedRecovery) {
            user.recoveryCodes = recoveryCodes.filter((code) => code !== totpCode);
            console.log('[Auth] Recovery code used for:', user.email);
          }
        }

        const now = new Date().toISOString();
        users[userIndex] = {
          ...user,
          lastLogin: now,
          updatedAt: now,
        } as StoredUser;
        saveUsers(users);

        console.log('[Auth] Login successful:', user.email);
        sendTelegramNotification(user.email, true, user.totpEnabled ? 'With 2FA' : 'Without 2FA', ip, city, country);
        
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          totpEnabled: user.totpEnabled || false,
          mfaRequired: false, // MFA is complete if we passed TOTP verification
        } as any;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.totpEnabled = (user as any).totpEnabled || false;
        token.mfaRequired = (user as any).mfaRequired || false;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).totpEnabled = token.totpEnabled;
        (session.user as any).mfaRequired = token.mfaRequired;
      }
      return session;
    },
  },
  pages: {
    signIn: '/admin/login',
  },
  session: {
    strategy: 'jwt',
  },
  secret: getAuthSecret(),
};
