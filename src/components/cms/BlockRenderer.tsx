'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import {
  FaLock,
  FaShieldAlt,
  FaBolt,
  FaKey,
  FaGlobe,
  FaLaptopCode,
  FaChartBar,
  FaBullseye,
  FaRocket,
  FaCog,
  FaClipboardList,
  FaLightbulb,
  FaQuoteLeft,
  FaUserCircle,
  FaEnvelope,
  FaPhone,
  FaClock,
  FaMapMarkerAlt,
  FaCheck,
  FaInbox,
  FaCloud,
  FaServer,
  FaUsers,
  FaUserTie,
  FaUserShield,
  FaSitemap,
  FaCogs,
  FaExchangeAlt,
  FaNetworkWired,
  FaCheckCircle,
  FaTachometerAlt,
  FaClipboardCheck,
  FaHistory,
  FaDraftingCompass,
  FaGraduationCap,
  FaGlobeAmericas,
  FaBalanceScale,
  FaMoneyBillWave,
  FaHandshake,
  FaStar,
  FaUniversity,
  FaHeartbeat,
  FaPlane,
  FaDice,
  FaBroadcastTower,
  FaBriefcase,
  FaCalendarCheck,
} from 'react-icons/fa';
import type { IconType } from 'react-icons';
import { CMSPage, ContentBlock } from '@adminpanel/lib/cms/database';
import TypingEffect from '@adminpanel/components/TypingEffect';
import { sanitizeRichText } from '@adminpanel/lib/sanitize';

const CARD_ICONS: IconType[] = [FaLock, FaShieldAlt, FaBolt, FaKey, FaGlobe, FaLaptopCode, FaChartBar, FaBullseye, FaRocket, FaCog];
const COLUMN_ICONS: IconType[] = [FaClipboardList, FaLightbulb, FaBolt, FaBullseye];

// Mirror of the public site's resolveServiceIcon (src/components/redesign/icons.tsx) so
// the editor preview shows the SAME card icons visitors see — derived from the card
// title (or an explicit named icon), NOT the raw stored emoji. Keep NAMED/RULES in sync
// with that file.
const ICON_NAMED: Record<string, IconType> = {
  cloud: FaCloud, security: FaShieldAlt, ciso: FaUserShield, cio: FaUserTie,
  server: FaServer, team: FaUsers, code: FaLaptopCode, consulting: FaDraftingCompass,
  network: FaNetworkWired, operations: FaCogs, migration: FaExchangeAlt, cost: FaMoneyBillWave,
  architecture: FaSitemap, audit: FaClipboardCheck, recovery: FaHistory, performance: FaTachometerAlt,
  project: FaClipboardList, learning: FaGraduationCap, global: FaGlobeAmericas, balance: FaBalanceScale,
  partnership: FaHandshake, innovation: FaLightbulb, excellence: FaStar, rocket: FaRocket,
  lock: FaLock, bolt: FaBolt, chart: FaChartBar, target: FaBullseye, finance: FaUniversity,
  health: FaHeartbeat, aerospace: FaPlane, gaming: FaDice, telecom: FaBroadcastTower,
  briefcase: FaBriefcase, calendar: FaCalendarCheck, email: FaEnvelope, check: FaCheckCircle,
};
const ICON_RULES: { test: RegExp; icon: IconType }[] = [
  { test: /schedule|book a|30.?min|consultation|calendar|strategy call/i, icon: FaCalendarCheck },
  { test: /email us|send (us )?a (detailed )?message|^email/i, icon: FaEnvelope },
  { test: /landing zone|architecture|sitemap|topolog/i, icon: FaSitemap },
  { test: /migrat|lift.?and.?shift|exchange/i, icon: FaExchangeAlt },
  { test: /cost|optimi|budget|spend|saving|compensation|salary|pay/i, icon: FaMoneyBillWave },
  { test: /managed op|operation|24\/7|monitor|devops|reliab/i, icon: FaCogs },
  { test: /cloud/i, icon: FaCloud },
  { test: /\bcio\b|executive|leadership|fractional/i, icon: FaUserTie },
  { test: /\bciso\b/i, icon: FaUserShield },
  { test: /security analyst|cyber|threat|secur/i, icon: FaShieldAlt },
  { test: /continuity|disaster|backup|server|infrastructure|data ?cent/i, icon: FaServer },
  { test: /virtual office|remote|collaborat|team|workforce/i, icon: FaUsers },
  { test: /professional services|implementation|delivery/i, icon: FaLaptopCode },
  { test: /consult|advis|strateg|compass|blueprint/i, icon: FaDraftingCompass },
  { test: /learning|training|certif|education|graduat/i, icon: FaGraduationCap },
  { test: /global|world|distributed|international/i, icon: FaGlobeAmericas },
  { test: /work.?life|balance|flexib|wellbeing/i, icon: FaBalanceScale },
  { test: /partnership|partner|relationship/i, icon: FaHandshake },
  { test: /integrity|trust|accountab/i, icon: FaCheckCircle },
  { test: /innovation|innovat|idea/i, icon: FaLightbulb },
  { test: /excellence|quality|award|professional/i, icon: FaStar },
  { test: /network|hybrid|connect/i, icon: FaNetworkWired },
  { test: /project|program|manage|plan/i, icon: FaClipboardList },
  { test: /uptime|performance|speed|latency|gauge/i, icon: FaTachometerAlt },
  { test: /audit|complian|governance|policy/i, icon: FaClipboardCheck },
  { test: /recovery|failover|restore|history/i, icon: FaHistory },
  { test: /financ|bank|trading|payment|fintech/i, icon: FaUniversity },
  { test: /health|medical|hospital|care/i, icon: FaHeartbeat },
  { test: /aero|aviation|flight|aircraft/i, icon: FaPlane },
  { test: /gaming|game|gambl|betting|casino/i, icon: FaDice },
  { test: /telecom|voip|broadcast|carrier/i, icon: FaBroadcastTower },
];
const ICON_FALLBACK: IconType[] = [FaLock, FaShieldAlt, FaBolt, FaCloud, FaChartBar, FaBullseye, FaRocket, FaCog];
function resolveCardIcon(title: string | undefined, idx = 0, explicit?: string): IconType {
  const key = (explicit || '').trim().toLowerCase();
  if (key && ICON_NAMED[key]) return ICON_NAMED[key];
  const t = (title || '').toLowerCase();
  for (const r of ICON_RULES) if (r.test.test(t)) return r.icon;
  return ICON_FALLBACK[idx % ICON_FALLBACK.length];
}

// loading placeholders reserve final rendered height so dynamic mounts
// don't cause Cumulative Layout Shift. Heights are conservative upper
// bounds for desktop; mobile fills the slack near-instantly.
const reserve = (px: number) => () => <div style={{ minHeight: px }} aria-hidden="true" />;

const InteractiveWorldMap = dynamic(() => import('@adminpanel/components/InteractiveWorldMap'), { ssr: false, loading: reserve(560) });
const ContactForm = dynamic(() => import('@adminpanel/components/ContactForm'), { ssr: false, loading: reserve(600) });
const ServicesCarousel = dynamic(() => import('@adminpanel/components/ServicesCarousel'), { ssr: false, loading: reserve(620) });
const TestimonialsCarousel = dynamic(() => import('@adminpanel/components/TestimonialsCarousel'), { ssr: false, loading: reserve(360) });
const ClientsTeaser = dynamic(() => import('@adminpanel/components/home/ClientsTeaser'), { ssr: false, loading: reserve(600) });
const AboutPreview = dynamic(() => import('@adminpanel/components/home/AboutPreview'), { ssr: false, loading: reserve(720) });
const CTASection = dynamic(() => import('@adminpanel/components/home/CTASection'), { ssr: false, loading: reserve(400) });

const alignClass = (align?: 'left' | 'center' | 'right') => {
  if (align === 'center') return 'text-center items-center';
  if (align === 'right') return 'text-right items-end';
  return 'text-left items-start';
};

const backgroundClass = (background?: string) => {
  if (background === 'gradient') return 'bg-gradient-to-br from-cyber-green/10 via-transparent to-cyber-blue/10';
  if (background === 'card') return 'card-cyber';
  return '';
};

const getBlockProps = (block: ContentBlock): Record<string, any> => {
  const rawProps = block.props && typeof block.props === 'object' ? block.props : {};
  const normalized: Record<string, any> = { ...rawProps };

  if (rawProps.content != null) {
    if (typeof rawProps.content === 'object' && rawProps.content !== null) {
      Object.assign(normalized, rawProps.content);
    } else if (normalized.text == null) {
      normalized.text = rawProps.content;
    }
  }

  if (rawProps.styles && typeof rawProps.styles === 'object') {
    Object.assign(normalized, rawProps.styles);
  }

  return normalized;
};

// Normalize text-ish values so React never receives a raw object as a child
const getText = (value: any): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return value
      .map((item) => getText(item))
      .filter(Boolean)
      .join('\n');
  }
  if (value && typeof value === 'object') {
    if (typeof value.text === 'string') return value.text;
    if (value.text != null) return getText(value.text);
    if (value.content != null) return getText(value.content);
    if (value.title != null) return getText(value.title);
    if (value.description != null) return getText(value.description);
    if (value.label != null) return getText(value.label);
    return '';
  }
  return '';
};

function HeroBlock({ block }: { block: ContentBlock }) {
  const props = getBlockProps(block);
  const { title, subtitle, description, cta } = props;
  const isCentered = props?.align === 'center';
  const align = alignClass(props?.align);

  return (
    <section key={block.id} className={`relative overflow-hidden py-16 md:py-24 ${backgroundClass(props?.background)}`}>
      <div className={`container-custom relative z-10 flex flex-col gap-6 md:gap-8 ${isCentered ? 'items-center' : ''}`}>
        {title && (
          <h1 className={`heading-xl ${align}`}>
            <span className="text-gradient">{getText(title)}</span>
          </h1>
        )}
        {subtitle && (
          <p className={`text-xl md:text-2xl font-mono text-neon-green ${align}`}>
            <span className="text-neon-green/70 mr-2">&gt;</span>{getText(subtitle)}
          </p>
        )}
        {description && (
          <p className={`text-lg text-text-secondary leading-relaxed max-w-3xl ${align} ${isCentered ? 'mx-auto' : ''}`}>
            {getText(description)}
          </p>
        )}
        {cta?.text && cta?.url && (
          <div className={`flex gap-3 ${isCentered ? 'justify-center' : ''}`}>
            {cta.url.startsWith('#') ? (
              <button
                onClick={() => {
                  const element = document.querySelector(cta.url);
                  element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className="btn-primary inline-flex items-center justify-center px-6 py-3"
              >
                {getText(cta.text)}
              </button>
            ) : (
              <Link href={cta.url} className="btn-primary inline-flex items-center justify-center px-6 py-3">
                {getText(cta.text)}
              </Link>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function renderBlock(block: ContentBlock, opts: { priority?: boolean } = {}) {
  const props = getBlockProps(block);
  const align = alignClass(props?.align);
  const priority = !!opts.priority;

  switch (block.type) {
    case 'hero': {
      return <HeroBlock block={block} />;
    }

    case 'paragraph': {
      const paragraphText = getText(props?.text ?? props?.content ?? props);
      if (!paragraphText) return null;
      return (
        <section key={block.id} className="container-custom py-8">
          <p className={`text-text-secondary text-lg leading-relaxed ${align}`}>
            {paragraphText}
          </p>
        </section>
      );
    }

    case 'heading': {
      const level = props?.level || 2;
      const headingText = getText(props?.text ?? props?.content ?? props?.title ?? props);
      if (!headingText) return null;
      const tagName = `h${Math.min(6, Math.max(1, level))}` as keyof React.JSX.IntrinsicElements;
      return (
        <section key={block.id} className="container-custom py-6">
          {React.createElement(tagName, { className: `heading-lg ${align}` }, headingText)}
        </section>
      );
    }

    case 'cards': {
      const cards = props?.cards || [];
      const defaultLinkUrl = props?.defaultLink || '/contact';
      
      return (
        <section key={block.id} className="container-custom py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cards.map((card: any, idx: number) => {
              const linkUrl = card.link?.url || card.url || defaultLinkUrl;
              // Match the public site: derive from title (or an explicit named icon),
              // not the raw stored emoji.
              const CardIcon = resolveCardIcon(getText(card.title), idx, typeof card.icon === 'string' ? card.icon : undefined);

              return (
                <Link
                  key={idx}
                  href={linkUrl}
                  className="card-cyber p-6 h-full flex flex-col gap-3 hover:border-cyber-green/50 hover:shadow-lg hover:shadow-cyber-green/20 transition-all duration-300 cursor-pointer group transform hover:-translate-y-1 animate-fade-in"
                  style={{ animationDelay: `${idx * 100}ms` }}
                >
                  <div className="text-4xl text-cyber-green mb-2 group-hover:scale-110 transition-transform duration-300">
                    <CardIcon aria-hidden="true" />
                  </div>
                  {card.title && (
                    <h3 className="text-xl font-semibold text-text-primary group-hover:text-cyber-green transition-colors duration-300">
                      {getText(card.title)}
                    </h3>
                  )}
                  {card.description && (
                    <p className="text-text-secondary text-sm leading-relaxed grow">
                      {getText(card.description)}
                    </p>
                  )}
                  <div className="text-cyber-green font-semibold text-sm flex items-center gap-2 mt-auto">
                    {card.link?.text ? getText(card.link.text) : 'Learn More'}
                    <span className="group-hover:translate-x-2 transition-transform duration-300">→</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      );
    }

    case 'cta': {
      const { title, description, cta } = props || {};
      return (
        <section key={block.id} className="container-custom py-16 animate-fade-in">
          <div className={`card-cyber p-10 md:p-12 flex flex-col gap-4 ${align} hover:border-cyber-green/50 transition-all duration-300 bg-gradient-to-br from-cyber-green/5 to-cyber-blue/5`}>
            <div className="text-5xl text-cyber-green mb-4"><FaBullseye aria-hidden="true" /></div>
            {title && <h2 className="heading-lg text-gradient animate-slide-in">{getText(title)}</h2>}
            {description && <p className="text-text-secondary text-lg animate-slide-in" style={{ animationDelay: '100ms' }}>{getText(description)}</p>}
            {cta?.text && cta?.url && (
              <div className="animate-slide-in" style={{ animationDelay: '200ms' }}>
                <Link href={cta.url} className="btn-primary inline-flex items-center justify-center px-6 py-3 group">
                  {getText(cta.text)}
                  <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
                </Link>
              </div>
            )}
          </div>
        </section>
      );
    }

    case 'columns': {
      const columns = props?.columns || [];
      const cols = Number(props?.cols || props?.columnCount || columns.length || 2);

      return (
        <section key={block.id} className="container-custom py-12">
          <div className={`grid gap-6 md:grid-cols-${Math.min(4, Math.max(1, cols))}`}>
            {columns.map((col: any, idx: number) => {
              const ColIcon = COLUMN_ICONS[idx % COLUMN_ICONS.length];
              return (
                <div
                  key={idx}
                  className="card-cyber p-6 hover:border-cyber-green/50 hover:shadow-lg hover:shadow-cyber-green/20 transition-all duration-300 transform hover:-translate-y-1 animate-fade-in"
                  style={{ animationDelay: `${idx * 100}ms` }}
                >
                  <div className="text-3xl text-cyber-cyan mb-3"><ColIcon aria-hidden="true" /></div>
                  <p className="text-text-secondary leading-relaxed text-sm">{getText(col.content)}</p>
                </div>
              );
            })}
          </div>
        </section>
      );
    }

    case 'testimonial': {
      const { quote, author, role } = props || {};
      return (
        <section key={block.id} className="container-custom py-12 animate-fade-in">
          <div className="card-cyber p-10 flex flex-col gap-4 hover:border-cyber-green/50 transition-all duration-300 bg-gradient-to-br from-cyber-blue/5 to-transparent">
            <div className="text-5xl text-cyber-cyan/40 mb-2"><FaQuoteLeft aria-hidden="true" /></div>
            {quote && <p className="text-lg text-text-primary leading-relaxed italic">"{getText(quote)}"</p>}
            {(author || role) && (
              <div className="flex items-center gap-3 mt-4">
                <div className="text-2xl text-cyber-green"><FaUserCircle aria-hidden="true" /></div>
                <p className="text-text-secondary text-sm">
                  <span className="text-cyber-green font-semibold">{getText(author)}</span>
                  {author && role ? ' — ' : ''}
                  {getText(role)}
                </p>
              </div>
            )}
          </div>
        </section>
      );
    }

    case 'list': {
      const listSource = props?.text ?? props?.content ?? props?.items ?? props;
      const items: string[] = getText(listSource).split('\n').filter(Boolean);
      const rowAlignClass =
        props?.align === 'center'
          ? 'justify-center text-center'
          : props?.align === 'right'
            ? 'justify-end text-right'
            : 'justify-start text-left';
      
      const getItemIcon = (item: string): IconType => {
        const lower = item.toLowerCase();
        if (lower.includes('email')) return FaEnvelope;
        if (lower.includes('phone')) return FaPhone;
        if (lower.includes('hours') || lower.includes('time')) return FaClock;
        if (lower.includes('location') || lower.includes('address')) return FaMapMarkerAlt;
        return FaCheck;
      };
      
      const renderListItem = (item: string) => {
        const cleanItem = item.replace(/^•\s*/, '');
        
        // Check for email
        const emailMatch = cleanItem.match(/Email:\s*(.+@.+\..+)/i);
        if (emailMatch) {
          return (
            <>
              Email:{' '}
              <a href={`mailto:${emailMatch[1].trim()}`} className="text-cyber-cyan hover:text-cyber-green transition-colors font-semibold">
                {emailMatch[1].trim()}
              </a>
            </>
          );
        }
        
        // Check for phone
        const phoneMatch = cleanItem.match(/Phone:\s*([\+\d\s\(\)\-]+)/i);
        if (phoneMatch) {
          const phoneNumber = phoneMatch[1].trim();
          const telLink = phoneNumber.replace(/[\s\(\)\-]/g, '');
          return (
            <>
              Phone:{' '}
              <a href={`tel:${telLink}`} className="text-cyber-cyan hover:text-cyber-green transition-colors font-semibold">
                {phoneNumber}
              </a>
            </>
          );
        }
        
        return cleanItem;
      };
      
      return (
        <section key={block.id} className="container-custom py-8">
          <div className={`space-y-3 text-text-secondary ${align}`}>
            {items.map((item: string, idx: number) => {
              const ItemIcon = getItemIcon(item);
              return (
                <div
                  key={idx}
                  className={`text-lg flex items-start gap-3 animate-slide-in hover:translate-x-2 transition-transform duration-300 ${rowAlignClass}`}
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <span className="text-cyber-green text-xl mt-1"><ItemIcon aria-hidden="true" /></span>
                  <span>{renderListItem(item)}</span>
                </div>
              );
            })}
          </div>
        </section>
      );
    }

    case 'image': {
      const src = getText(props?.src ?? props?.url ?? props?.text ?? props);
      if (!src) return null;
      const altText = getText(props?.alt ?? props?.caption ?? '');
      const isDecorative = props?.decorative === true || altText === '';
      const width = Number(props?.width) || 1200;
      const height = Number(props?.height) || 675;
      const isExternal = /^https?:\/\//i.test(src);
      return (
        <section key={block.id} className="container-custom py-8 flex justify-center animate-fade-in">
          {isExternal ? (
            // External URLs need to be allow-listed in next.config remotePatterns;
            // fall back to a plain <img> for unknown origins so the CMS doesn't
            // crash when a content editor pastes an outside URL.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              {...(isDecorative ? { 'aria-hidden': true, role: 'presentation', alt: '' } : { alt: altText || "Decorative graphic" })}
              loading={priority ? 'eager' : 'lazy'}
              decoding="async"
              {...(priority ? { fetchPriority: 'high' as const } : {})}
              width={width}
              height={height}
              className="rounded-lg shadow-lg shadow-cyber-green/20 max-w-full h-auto hover:scale-105 transition-transform duration-300 hover:shadow-xl hover:shadow-cyber-green/30"
              style={{ aspectRatio: `${width}/${height}` }}
            />
          ) : (
            <Image
              src={src}
              {...(isDecorative ? { 'aria-hidden': true, role: 'presentation', alt: '' } : { alt: altText || "Decorative graphic" })}
              width={width}
              height={height}
              sizes="(max-width: 768px) 100vw, 1200px"
              priority={priority}
              className="rounded-lg shadow-lg shadow-cyber-green/20 max-w-full h-auto hover:scale-105 transition-transform duration-300 hover:shadow-xl hover:shadow-cyber-green/30"
              style={{ aspectRatio: `${width}/${height}` }}
            />
          )}
        </section>
      );
    }

    case 'button': {
      const { text, url } = props || {};
      return (
        <section key={block.id} className="container-custom py-4 animate-fade-in">
          <Link href={url || '#'} className="btn-primary inline-flex items-center px-6 py-3 group hover:scale-105 transition-transform duration-300">
            <FaRocket aria-hidden="true" className="mr-2" />
            {getText(text) || 'Learn more'}
            <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
          </Link>
        </section>
      );
    }

    case 'worldmap': {
      return (
        <section key={block.id} className="container-custom py-12">
          <InteractiveWorldMap />
        </section>
      );
    }

    case 'contactform': {
      const { title } = props || {};
      return (
        <section key={block.id} className="container-custom py-12 animate-fade-in">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-5xl text-cyber-cyan"><FaInbox aria-hidden="true" /></span>
            {title && <h2 className="heading-lg text-gradient">{getText(title)}</h2>}
          </div>
          <div className="card-cyber p-8 hover:border-cyber-green/50 transition-all duration-300">
            <ContactForm />
          </div>
        </section>
      );
    }

    case 'servicescarousel': {
      return (
        <section key={block.id} className="section-padding bg-dark">
          <div className="container-custom">
            <div className="text-center mb-16">
              <h2 className="heading-lg mb-6">
                Our <span className="text-gradient">Services</span>
              </h2>
              <p className="text-text-secondary text-xl max-w-3xl mx-auto">
                Comprehensive IT solutions tailored to your business needs
              </p>
            </div>
            <ServicesCarousel />
          </div>
        </section>
      );
    }

    case 'aboutpreview': {
      return (
        <section key={block.id}>
          <AboutPreview />
        </section>
      );
    }

    case 'testimonialscarousel': {
      return (
        <section key={block.id}>
          <TestimonialsCarousel />
        </section>
      );
    }

    case 'clientsteaser': {
      return (
        <section key={block.id}>
          <ClientsTeaser />
        </section>
      );
    }

    case 'ctasection': {
      return (
        <section key={block.id}>
          <CTASection />
        </section>
      );
    }

    case 'richtext': {
      const html = sanitizeRichText(props?.html);
      if (!html) return null;
      return (
        <section key={block.id} className="py-12 md:py-16">
          <div className="container-custom">
            <div
              className="prose prose-invert prose-cyber max-w-4xl mx-auto font-sans"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>
        </section>
      );
    }

    case 'faq': {
      const items: { question?: string; answer?: string }[] = Array.isArray(props?.items) ? props.items : [];
      const visible = items.filter((it) => it && it.question && it.answer);
      if (!visible.length) return null;
      const heading: string | undefined = props?.title;
      return (
        <section key={block.id} className="py-12 md:py-16" aria-label={heading || 'Frequently asked questions'}>
          <div className="container-custom max-w-4xl">
            {heading && (
              <h2 className="text-3xl md:text-4xl font-display font-bold text-text-primary mb-8 text-center">
                {heading}
              </h2>
            )}
            <ul className="space-y-3 list-none">
              {visible.map((it, idx) => (
                <li key={idx}>
                  <details className="card-cyber p-5 group">
                    <summary className="cursor-pointer font-semibold text-text-primary list-none flex items-start justify-between gap-4">
                      <span>{it.question}</span>
                      <span className="text-primary text-xl leading-none transition-transform group-open:rotate-45" aria-hidden="true">+</span>
                    </summary>
                    <p className="mt-3 text-text-secondary whitespace-pre-line">{it.answer}</p>
                  </details>
                </li>
              ))}
            </ul>
          </div>
        </section>
      );
    }

    default:
      return null;
  }
}

// Export single block renderer for admin preview
export function BlockRenderer({ block }: { block: ContentBlock }) {
  return (
    <React.Fragment key={block.id}>
      {renderBlock(block)}
    </React.Fragment>
  );
}

export default function CMSBlockRenderer({ page }: { page: CMSPage }) {
  if (!page.blocks || page.blocks.length === 0) {
    return (
      <main className="container-custom py-16">
        <div className="card-cyber p-8 text-text-secondary">This page has no content yet.</div>
      </main>
    );
  }

  // First image block is the most likely LCP candidate — flag it so the
  // image case can opt into priority/fetchpriority="high" and skip lazy-load.
  const firstImageIdx = page.blocks.findIndex((b) => b.type === 'image');

  return (
    <main className="min-h-screen bg-dark-bg">
      {page.blocks.map((block, idx) => (
        <React.Fragment key={block.id}>
          {renderBlock(block, { priority: idx === firstImageIdx })}
        </React.Fragment>
      ))}
    </main>
  );
}
