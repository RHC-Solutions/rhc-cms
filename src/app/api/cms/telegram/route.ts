import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { cmsDb } from '@/lib/cms/database';

// Check if user is admin
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

// POST /api/cms/telegram - Save Telegram settings
export async function POST(request: NextRequest) {
  // Check admin authorization
  const adminCheck = await checkAdmin(request);
  if (!adminCheck.authorized) {
    return adminCheck.response;
  }

  try {
    const { botToken, chatId } = await request.json();

    if (!botToken || !chatId) {
      return NextResponse.json({ error: 'Bot token and chat ID are required' }, { status: 400 });
    }

    // Validate bot token format
    if (!/^\d+:[A-Za-z0-9_-]+$/.test(botToken.trim())) {
      return NextResponse.json({ error: 'Invalid bot token format' }, { status: 400 });
    }

    // Validate chat ID is numeric
    if (!/^[0-9-]+$/.test(chatId.trim())) {
      return NextResponse.json({ error: 'Invalid chat ID format' }, { status: 400 });
    }

    // Load existing settings
    const settings = await cmsDb.getSettings();

    // Update Telegram settings
    const telegram = (settings as any).telegram || {};
    telegram.botToken = botToken.trim();
    telegram.chatId = chatId.trim();

    // Save settings
    await cmsDb.updateSettings({
      ...settings,
      telegram
    } as any);

    return NextResponse.json({
      success: true,
      message: 'Telegram settings saved successfully',
      telegram: {
        botToken: '***' + botToken.slice(-10), // Don't return full token
        chatId: chatId,
      },
    });
  } catch (error) {
    console.error('Error saving Telegram settings:', error);
    return NextResponse.json(
      { error: 'Failed to save Telegram settings' },
      { status: 500 }
    );
  }
}
