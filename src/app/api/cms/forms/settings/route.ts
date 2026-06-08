import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import fs from 'fs';
import path from 'path';

const FORMS_FILE = path.join((process.env.SHARED_ROOT || process.cwd()), 'cms-data', 'forms.json');

const ensureDir = () => {
  const dir = path.dirname(FORMS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
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

// PATCH - Update form settings (enable/disable, notifications, etc.)
export async function PATCH(request: NextRequest) {
  const auth = await checkAdmin(request);
  if (!auth.authorized) return auth.response;

  try {
    const body = await request.json();
    const { formId, enabled, emailTo, notifications } = body;

    // Reject prototype-pollution keys before using formId as an index
    // (js/prototype-polluting-assignment).
    if (
      typeof formId !== 'string' ||
      formId === '__proto__' ||
      formId === 'constructor' ||
      formId === 'prototype'
    ) {
      return NextResponse.json({ error: 'Invalid form id' }, { status: 400 });
    }

    const forms = loadForms();

    if (!Object.prototype.hasOwnProperty.call(forms, formId)) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    if (enabled !== undefined) forms[formId].enabled = enabled;
    if (emailTo) forms[formId].emailTo = emailTo;
    if (notifications) forms[formId].notifications = { ...forms[formId].notifications, ...notifications };

    saveForms(forms);

    return NextResponse.json(forms[formId]);
  } catch (error) {
    console.error('Error updating form settings', error);
    return NextResponse.json({ error: 'Failed to update form settings' }, { status: 500 });
  }
}
