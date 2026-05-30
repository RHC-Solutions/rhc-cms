import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { cmsDb } from '@/lib/cms/database';
import { reinitScheduler } from '@/lib/scheduler-init';

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

interface SchedulerSettings {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  time: string;
  dayOfWeek?: string;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await checkAdmin(request);
    if (!auth.authorized) {
      return auth.response;
    }

    const body = await request.json();
    const schedulerSettings: SchedulerSettings = {
      enabled: body.enabled || false,
      frequency: body.frequency || 'daily',
      time: body.time || '02:00',
      dayOfWeek: body.dayOfWeek || 'sunday',
    };

    // Validate settings
    if (schedulerSettings.enabled) {
      if (!['daily', 'weekly', 'monthly'].includes(schedulerSettings.frequency)) {
        return NextResponse.json(
          { error: 'Invalid frequency. Must be daily, weekly, or monthly.' },
          { status: 400 }
        );
      }

      if (!/^\d{2}:\d{2}$/.test(schedulerSettings.time)) {
        return NextResponse.json(
          { error: 'Invalid time format. Use HH:mm format.' },
          { status: 400 }
        );
      }

      const validDays = [
        'sunday',
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
      ];
      if (
        schedulerSettings.frequency === 'weekly' &&
        !validDays.includes(schedulerSettings.dayOfWeek || '')
      ) {
        return NextResponse.json(
          { error: 'Invalid day of week for weekly backups.' },
          { status: 400 }
        );
      }
    }

    // Update settings in database
    const currentSettings = await cmsDb.getSettings();
    await cmsDb.updateSettings({
      ...currentSettings,
      scheduler: schedulerSettings,
    } as any);

    // Reinitialize the scheduler with new settings
    try {
      await reinitScheduler();
    } catch (e) {
      console.warn('Could not reinitialize scheduler:', e);
    }

    return NextResponse.json({
      success: true,
      message: 'Scheduler settings saved successfully',
      scheduler: schedulerSettings,
    });
  } catch (error) {
    console.error('Error saving scheduler settings:', error);
    return NextResponse.json(
      { error: 'Failed to save scheduler settings' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await checkAdmin(request);
    if (!auth.authorized) {
      return auth.response;
    }

    const settings = await cmsDb.getSettings();
    return NextResponse.json({
      success: true,
      scheduler: (settings as any).scheduler || {
        enabled: false,
        frequency: 'daily',
        time: '02:00',
        dayOfWeek: 'sunday'
      },
    });
  } catch (error) {
    console.error('Error fetching scheduler settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scheduler settings' },
      { status: 500 }
    );
  }
}
