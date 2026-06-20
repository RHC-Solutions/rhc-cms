import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// A well-formed Telegram bot token contains only digits, a colon and url-safe
// characters — none of which can change the host/path of the api.telegram.org
// request, so this also serves as an SSRF guard.
function isValidBotToken(token: unknown): token is string {
  return typeof token === 'string' && /^\d{6,}:[A-Za-z0-9_-]{30,}$/.test(token);
}

async function requireAdmin(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return false;
  const role = String((token as any).role || '').toLowerCase();
  return role === 'admin' || role === 'administrator';
}

export async function POST(request: NextRequest) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { botToken, chatId, botName } = await request.json();

    if (!botToken || !chatId) {
      return NextResponse.json(
        { success: false, message: 'Bot token and chat ID are required' },
        { status: 400 }
      );
    }

    if (!isValidBotToken(botToken)) {
      return NextResponse.json(
        { success: false, message: 'Invalid bot token format' },
        { status: 400 }
      );
    }

    // Send test message via Telegram Bot API
    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `✅ Test message from ${botName || 'Telegram Bot'}\n\nThis is a test to verify your bot credentials are working correctly.\n\nTimestamp: ${new Date().toISOString()}`,
        parse_mode: 'HTML',
      }),
    });

    const data = await response.json();

    if (response.ok && data.ok) {
      return NextResponse.json({
        success: true,
        message: `✓ Test message sent successfully to ${botName || 'Telegram'}!`,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          message: `Failed: ${data.description || 'Unknown error'}`,
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Telegram test error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to send test message' },
      { status: 500 }
    );
  }
}
