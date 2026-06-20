import { google } from 'googleapis';
import { getSecret } from '../env';

/**
 * Optional Google Calendar sync for confirmed appointments. No-op unless the
 * admin has configured an OAuth client + refresh token in /admin/integrations
 * (so no full OAuth flow is required to ship). All calls are best-effort —
 * calendar failures never block a booking.
 */

export function calendarConfigured(): boolean {
  return !!(
    getSecret('GOOGLE_CALENDAR_CLIENT_ID') &&
    getSecret('GOOGLE_CALENDAR_CLIENT_SECRET') &&
    getSecret('GOOGLE_CALENDAR_REFRESH_TOKEN')
  );
}

function getCalendar() {
  const oauth = new google.auth.OAuth2(
    getSecret('GOOGLE_CALENDAR_CLIENT_ID'),
    getSecret('GOOGLE_CALENDAR_CLIENT_SECRET'),
  );
  oauth.setCredentials({ refresh_token: getSecret('GOOGLE_CALENDAR_REFRESH_TOKEN') });
  return google.calendar({ version: 'v3', auth: oauth });
}

function calendarId(): string {
  return getSecret('GOOGLE_CALENDAR_ID') || 'primary';
}

export async function createCalendarEvent(input: {
  summary: string;
  description?: string | null;
  startIso: string;
  endIso: string;
  attendeeEmail?: string | null;
}): Promise<string | null> {
  if (!calendarConfigured()) return null;
  try {
    const calendar = getCalendar();
    const res = await calendar.events.insert({
      calendarId: calendarId(),
      requestBody: {
        summary: input.summary,
        description: input.description || undefined,
        start: { dateTime: input.startIso },
        end: { dateTime: input.endIso },
        attendees: input.attendeeEmail ? [{ email: input.attendeeEmail }] : undefined,
      },
    });
    return res.data.id ?? null;
  } catch (err) {
    console.error('[booking/calendar] create event failed', err);
    return null;
  }
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  if (!calendarConfigured() || !eventId) return;
  try {
    const calendar = getCalendar();
    await calendar.events.delete({ calendarId: calendarId(), eventId });
  } catch (err) {
    console.error('[booking/calendar] delete event failed', err);
  }
}
