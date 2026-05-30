import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import fs from 'fs';
import path from 'path';

interface FormSubmission {
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

// PATCH - Update submission status
export async function PATCH(request: NextRequest) {
  const auth = await checkAdmin(request);
  if (!auth.authorized) return auth.response;

  try {
    const body = await request.json();
    const { id, status, notes } = body;

    const submissions = loadSubmissions();
    const idx = submissions.findIndex((s) => s.id === id);

    if (idx === -1) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    if (status) submissions[idx].status = status;
    if (notes !== undefined) submissions[idx].notes = notes;
    
    saveSubmissions(submissions);

    return NextResponse.json(submissions[idx]);
  } catch (error) {
    console.error('Error updating submission', error);
    return NextResponse.json({ error: 'Failed to update submission' }, { status: 500 });
  }
}

// DELETE - Delete submission
export async function DELETE(request: NextRequest) {
  const auth = await checkAdmin(request);
  if (!auth.authorized) return auth.response;

  try {
    const body = await request.json();
    const { id } = body;

    let submissions = loadSubmissions();
    const idx = submissions.findIndex((s) => s.id === id);

    if (idx === -1) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    submissions = submissions.filter((s) => s.id !== id);
    saveSubmissions(submissions);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting submission', error);
    return NextResponse.json({ error: 'Failed to delete submission' }, { status: 500 });
  }
}
