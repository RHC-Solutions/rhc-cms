import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import { getSecret } from '@adminpanel/lib/env';
import { sendBrevoEmail, addBrevoContact } from '@adminpanel/lib/brevo';

export interface FormSubmission {
  id: string;
  formId: string;
  formName: string;
  data: Record<string, string>;
  email?: string;
  status: 'new' | 'reviewed' | 'replied';
  submittedAt: string;
  submittedBy?: string;
  notes?: string;
}

const SUBMISSIONS_FILE = path.join((process.env.SHARED_ROOT || process.cwd()), 'cms-data', 'submissions.json');
const FORMS_FILE = path.join((process.env.SHARED_ROOT || process.cwd()), 'cms-data', 'forms.json');

const getAdminEmail = () => getSecret('ADMIN_EMAIL') || 'info@rhcsolutions.com';

const ensureDir = () => {
  const dir = path.dirname(SUBMISSIONS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const loadSubmissions = (): FormSubmission[] => {
  ensureDir();
  if (!fs.existsSync(SUBMISSIONS_FILE)) {
    return [];
  }
  try {
    const data = fs.readFileSync(SUBMISSIONS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    console.error('Failed to load submissions', e);
    return [];
  }
};

const saveSubmissions = (submissions: FormSubmission[]) => {
  ensureDir();
  fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(submissions, null, 2));
};

const loadForms = (): Record<string, any> => {
  ensureDir();
  if (!fs.existsSync(FORMS_FILE)) {
    return {};
  }
  try {
    const data = fs.readFileSync(FORMS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    console.error('Failed to load forms', e);
    return {};
  }
};

const saveForms = (forms: Record<string, any>) => {
  ensureDir();
  fs.writeFileSync(FORMS_FILE, JSON.stringify(forms, null, 2));
};

const checkAdmin = async (request: NextRequest) => {
  const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET });
  const role = (token as any)?.role;
  if (role !== 'admin' && role !== 'editor') {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 403 }),
    };
  }
  return { authorized: true };
};

const sendTelegram = async (message: string) => {
  const botToken = getSecret('TELEGRAM_FORMS_BOT_TOKEN') || getSecret('TELEGRAM_BOT_TOKEN');
  const chatId = getSecret('TELEGRAM_FORMS_CHAT_ID') || getSecret('TELEGRAM_CHAT_ID');
  if (!botToken || !chatId) {
    console.warn('Telegram bot token / chat ID not configured — skipping notification');
    return;
  }
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    });
  } catch (error) {
    console.error('Failed to send Telegram message', error);
  }
};

const sendEmail = async (to: string, subject: string, html: string) => {
  // Check if Brevo is configured first for reliable transactional email delivery via API
  const brevoApiKey = getSecret('BREVO_API_KEY');
  if (brevoApiKey) {
    try {
      const res = await sendBrevoEmail({
        to,
        subject,
        htmlContent: html,
      });
      if (res.success) {
        return;
      }
      console.warn('[Forms] Brevo email delivery failed, falling back to SMTP:', res.error);
    } catch (brevoErr) {
      console.error('[Forms] Brevo email API exception, falling back to SMTP:', brevoErr);
    }
  }

  try {
    const smtpUser = getSecret('SMTP_USER');
    const transporter = nodemailer.createTransport({
      host: getSecret('SMTP_HOST') || 'localhost',
      port: parseInt(getSecret('SMTP_PORT') || '587'),
      secure: getSecret('SMTP_SECURE') === 'true',
      auth: smtpUser
        ? {
            user: smtpUser,
            pass: getSecret('SMTP_PASS'),
          }
        : undefined,
    });

    await transporter.sendMail({
      from: getAdminEmail(),
      to,
      subject,
      html,
    });
  } catch (error) {
    console.error('Failed to send email', error);
  }
};

export async function GET(request: NextRequest) {
  const auth = await checkAdmin(request);
  if (!auth.authorized) return auth.response;

  const forms = loadForms();
  const submissions = loadSubmissions();
  
  return NextResponse.json({ forms, submissions });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { formId, formName, data, email } = body;

    if (!formId || !formName || !data) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const submissions = loadSubmissions();
    const submission: FormSubmission = {
      id: Date.now().toString(),
      formId,
      formName,
      data,
      email,
      status: 'new',
      submittedAt: new Date().toISOString(),
    };

    submissions.push(submission);
    saveSubmissions(submissions);

    // Sync contact with Brevo if email is provided
    if (email && email.trim() !== '') {
      try {
        const nameVal = data.name || data.Name || data.fullName || data.fullname || '';
        const parts = nameVal.trim().split(/\s+/);
        const firstName = parts[0] || '';
        const lastName = parts.slice(1).join(' ') || '';
        await addBrevoContact({
          email,
          firstName,
          lastName,
          attributes: {
            SOURCE: `Form: ${formName}`,
            ...data,
          },
        });
      } catch (brevoErr) {
        console.error('[Forms] Failed to sync contact to Brevo:', brevoErr);
      }
    }

    // Send notifications
    const dataStr = Object.entries(data)
      .map(([k, v]) => `<b>${k}:</b> ${v}`)
      .join('<br/>');

    const telegramMsg = `📋 <b>New Form Submission</b>\n\n<b>Form:</b> ${formName}\n<b>Email:</b> ${email || 'N/A'}\n\n${dataStr}`;
    await sendTelegram(telegramMsg);

    const emailHtml = `
      <h2>New ${formName} Submission</h2>
      <p><strong>Email:</strong> ${email || 'N/A'}</p>
      <hr/>
      ${dataStr}
    `;
    await sendEmail(getAdminEmail(), `New ${formName} Submission`, emailHtml);

    return NextResponse.json(submission, { status: 201 });
  } catch (error) {
    console.error('Error creating submission', error);
    return NextResponse.json(
      { error: 'Failed to create submission' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const auth = await checkAdmin(request);
  if (!auth.authorized) return auth.response;

  try {
    const body = await request.json();
    const { id, status, notes } = body;

    const submissions = loadSubmissions();
    const idx = submissions.findIndex((s) => s.id === id);

    if (idx === -1) {
      return NextResponse.json(
        { error: 'Submission not found' },
        { status: 404 }
      );
    }

    submissions[idx].status = status || submissions[idx].status;
    submissions[idx].notes = notes || submissions[idx].notes;
    saveSubmissions(submissions);

    return NextResponse.json(submissions[idx]);
  } catch (error) {
    console.error('Error updating submission', error);
    return NextResponse.json(
      { error: 'Failed to update submission' },
      { status: 500 }
    );
  }
}
