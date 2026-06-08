import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import fs from 'fs';
import path from 'path';

interface Job {
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

const JOBS_FILE = path.join((process.env.SHARED_ROOT || process.cwd()), 'cms-data', 'jobs.json');

const ensureDir = () => {
  const dir = path.dirname(JOBS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const loadJobs = (): Job[] => {
  ensureDir();
  if (!fs.existsSync(JOBS_FILE)) {
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(JOBS_FILE, 'utf-8'));
  } catch (e) {
    return [];
  }
};

const saveJobs = (jobs: Job[]) => {
  ensureDir();
  fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs, null, 2));
};

const checkAuth = async (request: NextRequest): Promise<NextRequest | NextResponse> => {
  const token = await getToken({ req: request });
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return request;
};

// POST /api/cms/jobs/import - Import jobs from rhcsolutions.com/jobs
export async function POST(request: NextRequest) {
  const authResult = await checkAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || 'https://rhcsolutions.com').replace(/\/$/, '');
    const careersUrl = `${siteUrl}/careers`;
    // Fetch jobs from the careers page
    const response = await fetch(careersUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch careers page' }, { status: 400 });
    }

    const html = await response.text();

    // Parse job listings from the HTML
    // Look for JSON-LD structured data or parse from HTML
    const jsonLdMatch = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
    let parsedJobs: Job[] = [];

    if (jsonLdMatch) {
      try {
        const jsonLd = JSON.parse(jsonLdMatch[1]);
        
        // Handle both single job and array of jobs
        const jobs = Array.isArray(jsonLd['@graph']) ? jsonLd['@graph'] : [jsonLd];
        
        parsedJobs = jobs
          .filter((item: any) => item['@type'] === 'JobPosting')
          .map((job: any, idx: number) => ({
            id: `imported-${Date.now()}-${idx}`,
            title: job.title || 'Unknown Position',
            department: job.hiringOrganization?.name || 'General',
            locationType: job.jobLocationType === 'TELECOMMUTE' ? 'remote' : 'hybrid',
            city: job.jobLocation?.address?.addressLocality || '',
            country: job.jobLocation?.address?.addressCountry || 'US',
            type: job.employmentType?.[0]?.split('/').pop()?.replace('-', ' ') || 'Full-time',
            description: job.description || job.summary || '',
            requirements: job.qualifications?.join('\n') || '',
            visible: true,
            postedDate: job.datePosted?.split('T')[0] || new Date().toISOString().split('T')[0],
            createdBy: 'system-import',
            updatedBy: 'system-import',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }));
      } catch (e) {
        console.error('Failed to parse structured data:', e);
      }
    }

    // If no structured data found, create a default imported job
    if (parsedJobs.length === 0) {
      // Extract visible job titles from HTML. Capture the inner text group
      // directly (it's already `[^<]+`, i.e. tag-free) rather than stripping
      // tags after the fact (js/incomplete-multi-character-sanitization).
      const titleMatches = [...html.matchAll(/<h2[^>]*>([^<]+)<\/h2>/g)];
      parsedJobs = titleMatches.map((match, idx) => {
        const title = match[1].trim();
        return {
          id: `imported-${Date.now()}-${idx}`,
          title: title || 'Career Opportunity',
          department: 'General',
          locationType: 'remote' as const,
          type: 'Full-time' as const,
          description: `See ${careersUrl} for details`,
          requirements: 'Competitive experience in IT services',
          visible: true,
          postedDate: new Date().toISOString().split('T')[0],
          createdBy: 'system-import',
          updatedBy: 'system-import',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      });
    }

    // Merge with existing jobs (avoid duplicates by title)
    const existingJobs = loadJobs();
    const existingTitles = new Set(existingJobs.map((j) => j.title));
    const newJobs = parsedJobs.filter((j) => !existingTitles.has(j.title));

    const allJobs = [...existingJobs, ...newJobs];
    saveJobs(allJobs);

    return NextResponse.json({
      success: true,
      imported: newJobs.length,
      total: allJobs.length,
      jobs: newJobs,
    });
  } catch (error) {
    console.error('[API] Job import error:', error);
    return NextResponse.json(
      { error: 'Failed to import jobs', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
