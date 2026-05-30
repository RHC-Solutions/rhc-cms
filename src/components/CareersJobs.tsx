import fs from 'fs';
import path from 'path';
import CareersJobsClient from './CareersJobsClient';
import { JsonLd, jobPostingLd } from './JsonLd';

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
}

export default async function CareersJobs() {
  const jobsFile = path.join((process.env.SHARED_ROOT || process.cwd()), 'cms-data', 'jobs.json');
  let jobs: Job[] = [];
  try {
    const data = JSON.parse(fs.readFileSync(jobsFile, 'utf-8')) as Job[];
    jobs = data.filter((j) => j.visible);
  } catch {}

  const postings = jobs.map((j) =>
    jobPostingLd(
      {
        id: j.id,
        title: j.title,
        description: [j.description, j.requirements].filter(Boolean).join('\n\n') || j.title,
        location: j.city && j.country ? `${j.city}, ${j.country}` : j.country || j.city,
        type: j.type,
        postedAt: j.postedDate ? new Date(j.postedDate).toISOString() : undefined,
        remote: j.locationType === 'remote',
        department: j.department,
      },
      'RHC Solutions',
    ),
  );

  return (
    <>
      {postings.length > 0 && <JsonLd data={postings} />}
      <CareersJobsClient jobs={jobs} />
    </>
  );
}
