import { getSecret } from './env';

interface BrevoEmailSender {
  name?: string;
  email: string;
}

interface BrevoEmailRecipient {
  name?: string;
  email: string;
}

interface BrevoSendEmailPayload {
  sender?: BrevoEmailSender;
  to: BrevoEmailRecipient[];
  subject: string;
  htmlContent: string;
}

interface BrevoCreateContactPayload {
  email: string;
  attributes?: Record<string, any>;
  listIds?: number[];
  updateEnabled?: boolean;
}

/**
 * Sends a transactional email using the Brevo API.
 */
export async function sendBrevoEmail({
  to,
  subject,
  htmlContent,
  sender,
}: {
  to: string | BrevoEmailRecipient[];
  subject: string;
  htmlContent: string;
  sender?: BrevoEmailSender;
}): Promise<{ success: boolean; error?: string; messageId?: string }> {
  const apiKey = getSecret('BREVO_API_KEY');
  if (!apiKey) {
    console.warn('[Brevo] BREVO_API_KEY is not configured.');
    return { success: false, error: 'Brevo API key is not configured.' };
  }

  // Determine sender
  const defaultSenderEmail = getSecret('BREVO_SENDER_EMAIL') || getSecret('ADMIN_EMAIL') || 'admin@example.com';
  const defaultSenderName = getSecret('BREVO_SENDER_NAME') || 'Your Site Name';
  const finalSender: BrevoEmailSender = sender || {
    name: defaultSenderName,
    email: defaultSenderEmail,
  };

  // Determine recipients
  const finalRecipients: BrevoEmailRecipient[] = typeof to === 'string'
    ? [{ email: to }]
    : to;

  const payload: BrevoSendEmailPayload = {
    sender: finalSender,
    to: finalRecipients,
    subject,
    htmlContent,
  };

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Brevo] Failed to send email via API:', errorText);
      return { success: false, error: errorText || `HTTP ${response.status}` };
    }

    const data = await response.json();
    return { success: true, messageId: data.messageId };
  } catch (error: any) {
    console.error('[Brevo] SMTP API request error:', error);
    return { success: false, error: error?.message || 'Network error' };
  }
}

/**
 * Adds or updates a contact in Brevo, optionally registering them to a specific list.
 */
export async function addBrevoContact({
  email,
  firstName,
  lastName,
  attributes = {},
}: {
  email: string;
  firstName?: string;
  lastName?: string;
  attributes?: Record<string, any>;
}): Promise<{ success: boolean; error?: string }> {
  const apiKey = getSecret('BREVO_API_KEY');
  if (!apiKey) {
    console.warn('[Brevo] BREVO_API_KEY is not configured.');
    return { success: false, error: 'Brevo API key is not configured.' };
  }

  // Gather list IDs
  const listIdStr = getSecret('BREVO_CONTACT_LIST_ID');
  const listIds: number[] = [];
  if (listIdStr) {
    const parsed = parseInt(listIdStr, 10);
    if (!isNaN(parsed)) {
      listIds.push(parsed);
    }
  }

  const mergedAttributes: Record<string, any> = { ...attributes };
  if (firstName) mergedAttributes.FIRSTNAME = firstName;
  if (lastName) mergedAttributes.LASTNAME = lastName;

  const payload: BrevoCreateContactPayload = {
    email,
    updateEnabled: true,
  };

  if (Object.keys(mergedAttributes).length > 0) {
    payload.attributes = mergedAttributes;
  }

  if (listIds.length > 0) {
    payload.listIds = listIds;
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (response.status === 204) {
      return { success: true };
    }

    if (!response.ok) {
      const errorText = await response.text();
      // Handle the case where contact already exists and was modified or if it failed for other reasons
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.code === 'duplicate_parameter') {
          // Contact already exists on lists, this might be fine, but with updateEnabled=true, it shouldn't fail.
          // In some cases if we hit lists constraints or similar we might get duplicate errors.
          console.log('[Brevo] Contact already exists (duplicate parameter), update was successful/ignored');
          return { success: true };
        }
      } catch {}
      
      console.error('[Brevo] Failed to create/update contact:', errorText);
      return { success: false, error: errorText || `HTTP ${response.status}` };
    }

    return { success: true };
  } catch (error: any) {
    console.error('[Brevo] Lead synchronization error:', error);
    return { success: false, error: error?.message || 'Network error' };
  }
}
