import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { cmsDb } from '@adminpanel/lib/cms/database';
import { revalidateAllPublic } from '@adminpanel/lib/revalidate';

async function checkRole(token: any) {
  const role = token?.role;
  if (!role) return false;
  const normalized = String(role).toLowerCase();
  return ['administrator', 'admin', 'editor'].includes(normalized);
}

export async function GET() {
  try {
    const settings = await cmsDb.getSettings();
    
    if (!settings) {
      console.error('Settings not found in database');
      return NextResponse.json([], { status: 200 });
    }
    
    // Check if custom footer exists in settings
    const customFooter = (settings as any).customFooter;
    if (customFooter && Array.isArray(customFooter) && customFooter.length > 0) {
      return NextResponse.json(customFooter);
    }
    
    // Extract contact info from settings
    const contactInfo = (settings as any).contact || {};
    const socialLinks = (settings as any).footer?.socialLinks || [];
    
    // Build default footer from settings and navigation
    const footer = [
      {
        id: 'services',
        title: 'Services',
        links: [] as Array<{ name: string; href: string }>
      },
      {
        id: 'company',
        title: 'Company',
        links: [
          { name: 'About Us', href: '/about-us' },
          { name: 'Clients', href: '/clients' },
          { name: 'Partners', href: '/partners' },
          { name: 'Careers', href: '/careers' }
        ]
      },
      {
        id: 'legal',
        title: 'Legal',
        links: [
          { name: 'Privacy Policy', href: '/privacy' },
          { name: 'Cookie Policy', href: '/cookies' }
        ]
      },
      {
        id: 'contact',
        title: 'Contact',
        phone: contactInfo.phone || '',
        email: contactInfo.email || '',
        telegram: contactInfo.telegram?.replace('@', '') || '', // Remove @ prefix
        whatsapp: contactInfo.whatsapp?.replace(/[^0-9]/g, '') || '', // Keep only numbers
        socials: {
          linkedin: socialLinks.find((s: any) => s.platform === 'linkedin')?.url || '',
          facebook: socialLinks.find((s: any) => s.platform === 'facebook')?.url || '',
          twitter: socialLinks.find((s: any) => s.platform === 'twitter')?.url || '',
          instagram: socialLinks.find((s: any) => s.platform === 'instagram')?.url || '',
          github: socialLinks.find((s: any) => s.platform === 'github')?.url || ''
        },
        links: [
          { name: 'Contact Us', href: '/contact' }
        ]
      }
    ];

    // Get services pages for the services section
    const servicesPages = await cmsDb.getPages({ status: 'published', category: 'services' });
    const servicesSection = footer.find(section => section.id === 'services');
    
    if (servicesSection && servicesPages.length > 0) {
      servicesSection.links = servicesPages
        .filter(page => page.slug !== '/services') // Exclude main services page
        .map(page => ({
          name: page.title,
          href: page.slug
        }));
    }
    
    return NextResponse.json(footer);
  } catch (error) {
    console.error('Failed to read footer:', error);
    return NextResponse.json([], { status: 200 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET! });
    
    if (!token || !(await checkRole(token))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const footerData = await request.json();
    
    // Get current settings
    const settings = await cmsDb.getSettings();
    
    // Update social links in settings from contact section
    const contactSection = footerData.find((s: any) => s.id === 'contact');
    if (contactSection?.socials) {
      const socialLinksArray = [];
      
      if (contactSection.socials.linkedin) {
        socialLinksArray.push({ platform: 'linkedin', url: contactSection.socials.linkedin });
      }
      if (contactSection.socials.facebook) {
        socialLinksArray.push({ platform: 'facebook', url: contactSection.socials.facebook });
      }
      if (contactSection.socials.twitter) {
        socialLinksArray.push({ platform: 'twitter', url: contactSection.socials.twitter });
      }
      if (contactSection.socials.instagram) {
        socialLinksArray.push({ platform: 'instagram', url: contactSection.socials.instagram });
      }
      if (contactSection.socials.github) {
        socialLinksArray.push({ platform: 'github', url: contactSection.socials.github });
      }
      
      // Update settings with new social links
      await cmsDb.updateSettings({
        ...settings,
        footer: {
          ...(settings as any).footer,
          socialLinks: socialLinksArray
        },
        customFooter: footerData
      } as any);
    } else {
      // Just save the custom footer
      await cmsDb.updateSettings({
        ...settings,
        customFooter: footerData
      } as any);
    }
    
    revalidateAllPublic();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to save footer:', error);
    return NextResponse.json({ error: 'Failed to save footer' }, { status: 500 });
  }
}
