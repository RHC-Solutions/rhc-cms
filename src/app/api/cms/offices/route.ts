import { promises as fs } from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { revalidateAllPublic } from '@adminpanel/lib/revalidate';

const OFFICES_FILE = path.join((process.env.SHARED_ROOT || process.cwd()), 'cms-data', 'offices.json');

async function requireWriter(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return false;
  const role = String((token as any).role || '').toLowerCase();
  return ['admin', 'administrator', 'editor'].includes(role);
}

async function readOffices() {
  try {
    const data = await fs.readFile(OFFICES_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    // If file doesn't exist after restore, return default offices
    return getDefaultOffices();
  }
}

function getDefaultOffices() {
  return [
    {
      id: 'office-1',
      city: 'New York',
      country: 'United States',
      lat: 40.7128,
      lng: -74.0060,
      timezone: 'America/New_York',
      description: 'Headquarters',
      active: true,
      order: 1
    },
    {
      id: 'office-2',
      city: 'London',
      country: 'United Kingdom',
      lat: 51.5074,
      lng: -0.1278,
      timezone: 'Europe/London',
      description: 'European Office',
      active: true,
      order: 2
    },
    {
      id: 'office-3',
      city: 'Singapore',
      country: 'Singapore',
      lat: 1.3521,
      lng: 103.8198,
      timezone: 'Asia/Singapore',
      description: 'Asia-Pacific Office',
      active: true,
      order: 3
    }
  ];
}

async function writeOffices(offices: any[]) {
  await fs.writeFile(OFFICES_FILE, JSON.stringify(offices, null, 2));
}

export async function GET(request: NextRequest) {
  try {
    const offices = await readOffices();
    const activeOnly = request.nextUrl.searchParams.get('active');
    
    if (activeOnly === 'true') {
      return NextResponse.json(offices.filter((o: any) => o.active));
    }
    
    return NextResponse.json(offices);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to read offices' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await requireWriter(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const newOffice = await request.json();
    const offices = await readOffices();
    
    newOffice.id = newOffice.id || `office-${Date.now()}`;
    newOffice.order = newOffice.order || offices.length + 1;
    newOffice.active = newOffice.active !== false;
    
    offices.push(newOffice);
    await writeOffices(offices);
    
    revalidateAllPublic();
    return NextResponse.json(newOffice, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create office' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  if (!(await requireWriter(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id, ...updates } = await request.json();
    const offices = await readOffices();
    
    const index = offices.findIndex((o: any) => o.id === id);
    if (index === -1) {
      return NextResponse.json({ error: 'Office not found' }, { status: 404 });
    }
    
    offices[index] = { ...offices[index], ...updates, id };
    await writeOffices(offices);
    
    revalidateAllPublic();
    return NextResponse.json(offices[index]);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update office' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!(await requireWriter(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id } = await request.json();
    let offices = await readOffices();
    
    offices = offices.filter((o: any) => o.id !== id);
    await writeOffices(offices);
    
    revalidateAllPublic();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete office' }, { status: 500 });
  }
}
