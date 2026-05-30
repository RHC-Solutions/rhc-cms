import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import fs from 'fs';
import path from 'path';
import { revalidateAllPublic } from '@adminpanel/lib/revalidate';

const JOBS_FILE = path.join((process.env.SHARED_ROOT || process.cwd()), 'cms-data', 'jobs.json');

export interface Job {
  id: string;
  title: string;
  department: string;
  locationType: 'remote' | 'hybrid' | 'in-office';
  city?: string;
  country?: string;
  type: 'Full-time' | 'Part-time' | 'Contract' | 'Freelance';
  description: string;
  requirements: string;
  visible: boolean;
  postedDate: string;
  applicants?: number;
  createdBy?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

// Initialize default jobs
const initJobs = (): Job[] => {
  const defaultJobs: Job[] = [
    {
      id: '1',
      title: 'Senior Cloud Infrastructure Engineer',
      department: 'Cloud & Infrastructure',
      locationType: 'remote',
      type: 'Full-time',
      description: 'Design and implement scalable cloud infrastructure solutions for enterprise clients.',
      requirements: '5+ years cloud infrastructure experience\nAWS/Azure/GCP expertise\nTerraform/CloudFormation\nStrong networking knowledge',
      visible: true,
      postedDate: '2025-12-01',
      applicants: 12,
      createdBy: 'system',
      updatedBy: 'system',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: '2',
      title: 'Cyber Security Analyst',
      department: 'Cyber Security',
      locationType: 'hybrid',
      city: 'Sofia',
      country: 'Bulgaria',
      type: 'Full-time',
      description: 'Monitor, detect, and respond to security threats while implementing security best practices.',
      requirements: '3+ years security experience\nCISSP or CEH certified\nSIEM tools experience\nIncident response expertise',
      visible: true,
      postedDate: '2025-12-05',
      applicants: 8,
      createdBy: 'system',
      updatedBy: 'system',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: '3',
      title: 'DevOps Engineer',
      department: 'Professional Services',
      locationType: 'remote',
      type: 'Full-time',
      description: 'Build and maintain CI/CD pipelines and automate infrastructure deployment processes.',
      requirements: '4+ years DevOps experience\nKubernetes & Docker\nJenkins/GitLab CI\nPython/Bash scripting',
      visible: true,
      postedDate: '2025-12-08',
      applicants: 15,
      createdBy: 'system',
      updatedBy: 'system',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: '4',
      title: 'IT Project Manager',
      department: 'Professional Services',
      locationType: 'hybrid',
      city: 'Tel Aviv',
      country: 'Israel',
      type: 'Full-time',
      description: 'Lead IT transformation projects for enterprise clients from initiation to completion.',
      requirements: 'PMP or equivalent\n5+ years project management\nAgile/Scrum experience\nExcellent communication skills',
      visible: false,
      postedDate: '2025-11-20',
      applicants: 6,
      createdBy: 'system',
      updatedBy: 'system',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  if (!fs.existsSync(JOBS_FILE)) {
    const dir = path.dirname(JOBS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(JOBS_FILE, JSON.stringify(defaultJobs, null, 2));
  }

  return defaultJobs;
};

// Check role authorization
async function checkRole(request: NextRequest, allowedRoles: string[]) {
  const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET });
  const role = token && (token as any).role ? (token as any).role : null;

  if (!role || !allowedRoles.includes(role)) {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Unauthorized: insufficient permissions' }, { status: 403 }),
    };
  }

  return { authorized: true, role };
}

// GET /api/cms/jobs - Get all jobs
export async function GET(request: NextRequest) {
  try {
    const auth = await checkRole(request, ['admin', 'editor', 'jobs_manager']);
    if (!auth.authorized) return auth.response;

    if (!fs.existsSync(JOBS_FILE)) {
      return NextResponse.json(initJobs());
    }

    const data = fs.readFileSync(JOBS_FILE, 'utf-8');
    const jobs: Job[] = JSON.parse(data);
    return NextResponse.json(jobs);
  } catch (error) {
    console.error('Error fetching jobs:', error);
    return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 });
  }
}

// POST /api/cms/jobs - Create new job
export async function POST(request: NextRequest) {
  try {
    const auth = await checkRole(request, ['admin', 'editor', 'jobs_manager']);
    if (!auth.authorized) return auth.response;

    const body = await request.json();
    const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET });
    const email = token && (token as any).email ? (token as any).email : 'admin';

    if (!fs.existsSync(JOBS_FILE)) {
      initJobs();
    }

    const jobs: Job[] = JSON.parse(fs.readFileSync(JOBS_FILE, 'utf-8'));
    const newJob: Job = {
      ...body,
      id: Date.now().toString(),
      createdBy: email,
      updatedBy: email,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    jobs.push(newJob);
    fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs, null, 2));
    revalidateAllPublic();
    return NextResponse.json(newJob, { status: 201 });
  } catch (error) {
    console.error('Error creating job:', error);
    return NextResponse.json({ error: 'Failed to create job' }, { status: 500 });
  }
}

// PUT /api/cms/jobs - Update job
export async function PUT(request: NextRequest) {
  try {
    const auth = await checkRole(request, ['admin', 'editor', 'jobs_manager']);
    if (!auth.authorized) return auth.response;

    const body = await request.json();
    const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET });
    const email = token && (token as any).email ? (token as any).email : 'admin';
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    if (!fs.existsSync(JOBS_FILE)) {
      initJobs();
    }

    const jobs: Job[] = JSON.parse(fs.readFileSync(JOBS_FILE, 'utf-8'));
    const index = jobs.findIndex((j) => j.id === id);

    if (index === -1) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    jobs[index] = {
      ...jobs[index],
      ...updates,
      updatedBy: email,
      updatedAt: new Date().toISOString(),
    };

    fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs, null, 2));
    revalidateAllPublic();
    return NextResponse.json(jobs[index]);
  } catch (error) {
    console.error('Error updating job:', error);
    return NextResponse.json({ error: 'Failed to update job' }, { status: 500 });
  }
}

// DELETE /api/cms/jobs?id=123 - Delete job
export async function DELETE(request: NextRequest) {
  try {
    const auth = await checkRole(request, ['admin', 'editor', 'jobs_manager']);
    if (!auth.authorized) return auth.response;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    if (!fs.existsSync(JOBS_FILE)) {
      initJobs();
    }

    const jobs: Job[] = JSON.parse(fs.readFileSync(JOBS_FILE, 'utf-8'));
    const filtered = jobs.filter((j) => j.id !== id);

    if (filtered.length === jobs.length) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    fs.writeFileSync(JOBS_FILE, JSON.stringify(filtered, null, 2));
    revalidateAllPublic();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting job:', error);
    return NextResponse.json({ error: 'Failed to delete job' }, { status: 500 });
  }
}
