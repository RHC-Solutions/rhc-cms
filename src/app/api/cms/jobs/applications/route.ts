import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const APPLICATIONS_FILE = path.join((process.env.SHARED_ROOT || process.cwd()), 'cms-data', 'applications.json');

const loadApplications = () => {
  try {
    return JSON.parse(fs.readFileSync(APPLICATIONS_FILE, 'utf-8'));
  } catch (e) {
    return [];
  }
};

const saveApplications = (applications: any[]) => {
  fs.writeFileSync(APPLICATIONS_FILE, JSON.stringify(applications, null, 2));
};

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const jobId = searchParams.get('jobId');
    const status = searchParams.get('status');
    
    let applications = loadApplications();
    
    if (jobId) {
      applications = applications.filter((app: any) => app.jobId === jobId);
    }
    
    if (status) {
      applications = applications.filter((app: any) => app.status === status);
    }
    
    return NextResponse.json(applications);
  } catch (error) {
    console.error("Error fetching applications:", error);
    return NextResponse.json({ error: "Failed to fetch applications" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { applicationId, status } = body;
    
    if (!applicationId || !status) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    
    const applications = loadApplications();
    const index = applications.findIndex((app: any) => app.id === applicationId);
    
    if (index === -1) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }
    
    applications[index].status = status;
    saveApplications(applications);
    
    return NextResponse.json(applications[index]);
  } catch (error) {
    console.error("Error updating application:", error);
    return NextResponse.json({ error: "Failed to update application" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { applicationId } = body;
    
    if (!applicationId) {
      return NextResponse.json({ error: "Missing applicationId" }, { status: 400 });
    }
    
    let applications = loadApplications();
    applications = applications.filter((app: any) => app.id !== applicationId);
    saveApplications(applications);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting application:", error);
    return NextResponse.json({ error: "Failed to delete application" }, { status: 500 });
  }
}
