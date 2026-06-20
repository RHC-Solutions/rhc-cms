import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// A well-formed Telegram bot token contains only digits, a colon and url-safe
// characters — none of which can change the host/path of the api.telegram.org
// request, so this also serves as an SSRF guard.
function isValidBotToken(token: unknown): token is string {
  return typeof token === 'string' && /^\d{6,}:[A-Za-z0-9_-]{30,}$/.test(token);
}

// Test Telegram credentials
async function checkAdmin(request: NextRequest) {
  const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET });
  const role = token && (token as any).role ? (token as any).role : null;
  if (role !== 'admin') {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Unauthorized: admin role required' }, { status: 403 }),
    };
  }

  return { authorized: true };
}

export async function POST(request: NextRequest) {
  try {
    const auth = await checkAdmin(request);
    if (!auth.authorized) return auth.response;

    const { botToken, chatId } = await request.json();

    if (!botToken || !chatId) {
      return NextResponse.json(
        { success: false, message: 'Bot token and chat ID are required' },
        { status: 400 }
      );
    }

    // Telegram bot tokens are "<bot_id>:<auth_token>" (digits + url-safe chars).
    // Validating the exact shape keeps the value from altering the request
    // target when interpolated into the api.telegram.org URL (guards SSRF).
    if (!isValidBotToken(botToken)) {
      return NextResponse.json(
        { success: false, message: 'Invalid bot token format' },
        { status: 400 }
      );
    }

    // Test Telegram API connection
    try {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`, {
        method: 'GET',
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const error = await response.text();
        return NextResponse.json({
          success: false,
          message: `Bot token invalid: ${response.status}`,
          details: error,
        });
      }

      const botData = await response.json();

      if (!botData.ok) {
        return NextResponse.json({
          success: false,
          message: 'Bot token is invalid or bot is inactive',
          details: botData.description,
        });
      }

      // Test sending a message to chat ID
      const testResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: '✅ RHC Backup System - Connection Test Successful\n\nYour Telegram credentials are working correctly. Backups will now be sent to this chat.',
          parse_mode: 'HTML',
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!testResponse.ok) {
        const error = await testResponse.text();
        return NextResponse.json({
          success: false,
          message: `Chat ID invalid or bot cannot send messages: ${testResponse.status}`,
          details: error,
        });
      }

      const testData = await testResponse.json();

      if (!testData.ok) {
        return NextResponse.json({
          success: false,
          message: 'Chat ID is invalid. Make sure you sent /start to the bot first.',
          details: testData.description,
        });
      }

      return NextResponse.json({
        success: true,
        message: 'Telegram connection successful! Test message sent.',
        botName: botData.result.first_name,
      });
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return NextResponse.json({
          success: false,
          message: 'Connection timeout. Telegram API is not responding.',
        });
      }
      throw error;
    }
  } catch (error) {
    console.error('Error testing Telegram:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to test Telegram connection' },
      { status: 500 }
    );
  }
}
