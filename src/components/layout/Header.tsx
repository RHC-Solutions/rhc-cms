'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { FaBars, FaTimes, FaChevronDown } from 'react-icons/fa';

type Settings = {
  siteName: string;
  tagline: string;
  bookingUrl?: string;
};

type ThemeBranding = {
  logo?: string;
  logoSize?: number;
  siteNameSize?: string;
  taglineSize?: string;
  siteNameFont?: string;
  taglineFont?: string;
  menuFont?: string;
  menuFontSize?: string;
};

type MenuItem = {
  id: string;
  label: string;
  url: string;
  visible?: boolean;
  order?: number;
  children?: MenuItem[];
};


type HeaderProps = {
  initialSettings?: Settings;
  initialBranding?: ThemeBranding;
  initialNav?: MenuItem[];
};

const DEFAULT_SETTINGS: Settings = { siteName: 'Your Site Name', tagline: 'Customize this tagline' };
const DEFAULT_BRANDING: ThemeBranding = {
  logoSize: 40,
  siteNameSize: '2rem',
  taglineSize: '0.875rem',
  siteNameFont: 'JetBrains Mono, Courier New, monospace',
  taglineFont: 'JetBrains Mono, Courier New, monospace',
  menuFont: 'Inter, system-ui, sans-serif',
  menuFontSize: '1rem',
};
const DEFAULT_NAV: MenuItem[] = [
  { id: '1', label: 'Home', url: '/', visible: true, order: 1 },
  { id: '2', label: 'About', url: '/about-us', visible: true, order: 2 },
  { id: '3', label: 'Services', url: '/services', visible: true, order: 3, children: [] },
  { id: '4', label: 'Careers', url: '/careers', visible: true, order: 4 },
  { id: '5', label: 'Contact', url: '/contact', visible: true, order: 5 },
];

export default function Header({ initialSettings, initialBranding, initialNav }: HeaderProps = {}) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isServicesOpen, setIsServicesOpen] = useState(false);
  const [settings] = useState<Settings>(initialSettings || DEFAULT_SETTINGS);
  const [branding] = useState<ThemeBranding>(initialBranding || DEFAULT_BRANDING);
  const [navItems] = useState<MenuItem[]>(initialNav && initialNav.length ? initialNav : DEFAULT_NAV);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  // Filter services from navigation (items with children)
  const services = navItems
    .find((item: MenuItem) => item.label === 'Services')
    ?.children?.filter((child: MenuItem) => child.visible !== false)
    .sort((a: MenuItem, b: MenuItem) => (a.order || 0) - (b.order || 0)) || [];

  return (
    <header
      className={`fixed w-full top-0 z-50 transition-all duration-300 ${
        isScrolled 
          ? 'bg-dark border-b border-dark-border py-2 lg:py-2 shadow-[0_4px_20px_rgba(0,217,255,0.1)]' 
          : 'bg-dark py-6 pb-8 lg:py-4'
      }`}
    >
      <nav className="container-custom">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex flex-col lg:flex-row items-start lg:items-center lg:space-x-3 group">
            <div className="flex items-center space-x-2 lg:space-x-3">
              <Image
                src={branding.logo || '/logo.png'}
                alt={`${settings.siteName} Logo`}
                width={32}
                height={32}
                unoptimized
                className="transition-transform duration-300 group-hover:scale-110 lg:w-10 lg:h-10"
              />
              <div 
                className="text-text-primary font-bold transition-all duration-300 text-lg lg:text-[2rem] font-mono"
              >
                {settings.siteName.split(' ').map((word, i) => (
                  i === settings.siteName.split(' ').length - 1 ? 
                    <span key={i} className="text-gradient group-hover:opacity-80">{word}</span> :
                    <span key={i}>{word} </span>
                ))}
              </div>
            </div>
            <div 
              className="mt-2 lg:mt-0 lg:ml-3 tracking-wider text-accent text-xs lg:text-sm font-mono"
            >
              &gt; {settings.tagline}
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-8">
            {navItems.map((link) => (
              <div
                key={link.id}
                className="relative"
                onMouseEnter={() => link.children && link.children.length > 0 && setIsServicesOpen(true)}
                onMouseLeave={() => link.children && link.children.length > 0 && setIsServicesOpen(false)}
              >
                {link.children && link.children.length > 0 ? (
                  <>
                    <Link
                      href={link.url}
                      aria-haspopup="true"
                      aria-expanded={isServicesOpen}
                      aria-controls={`menu-${link.id}`}
                      onFocus={() => setIsServicesOpen(true)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          setIsServicesOpen(false);
                          (e.currentTarget as HTMLElement).blur();
                        }
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          setIsServicesOpen(true);
                          const first = document.querySelector<HTMLAnchorElement>(`#menu-${link.id} a`);
                          first?.focus();
                        }
                      }}
                      className={`flex items-center space-x-1 font-medium transition-colors font-sans text-base ${
                        pathname.startsWith(link.url)
                          ? 'text-cyber-blue'
                          : 'text-text-secondary hover:text-cyber-blue'
                      }`}
                    >
                      <span>{link.label}</span>
                      <FaChevronDown className={`text-xs transition-transform ${isServicesOpen ? 'rotate-180' : ''}`} />
                    </Link>
                    <div
                      id={`menu-${link.id}`}
                      role="menu"
                      aria-label={`${link.label} menu`}
                      onBlur={(e) => {
                        // Close when focus leaves the entire menu container
                        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                          setIsServicesOpen(false);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          setIsServicesOpen(false);
                          const trigger = (e.currentTarget.parentElement?.querySelector('a[aria-haspopup]') as HTMLElement);
                          trigger?.focus();
                        }
                      }}
                      className={`absolute left-0 mt-2 w-64 bg-dark-card border border-dark-border shadow-[0_8px_32px_rgba(0,217,255,0.15)] rounded-lg transition-all duration-200 ${
                        isServicesOpen ? 'opacity-100 visible' : 'opacity-0 invisible'
                      }`}
                    >
                      <div className="py-2">
                        {services.map((service: MenuItem) => (
                          <Link
                            key={service.id || service.url}
                            href={service.url}
                            role="menuitem"
                            tabIndex={isServicesOpen ? 0 : -1}
                            className={`block px-4 py-2 text-sm transition-all duration-300 ${
                              pathname === service.url
                                ? 'bg-linear-to-r from-cyber-blue to-cyber-cyan text-dark font-bold'
                                : 'text-text-secondary hover:text-cyber-blue hover:bg-dark-lighter hover:pl-6'
                            }`}
                          >
                            {service.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <Link
                    href={link.url}
                    className={`font-medium transition-colors relative group/link ${
                      pathname === link.url
                        ? 'text-cyber-blue'
                        : 'text-text-secondary hover:text-cyber-blue'
                    }`}
                  >
                    {link.label}
                    <span className={`absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-accent transition-all duration-300 group-hover/link:w-full ${
                      pathname === link.url ? 'w-full' : ''
                    }`} />
                  </Link>
                )}
              </div>
            ))}
            {settings.bookingUrl && (
              <a
                href={settings.bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Book a 30-min call (opens external calendar)"
                className="btn-primary"
              >
                Book a 30-min call
              </a>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="lg:hidden text-2xl text-cyber-blue hover:text-cyber-cyan transition-colors"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-nav"
          >
            {isMobileMenuOpen ? <FaTimes /> : <FaBars />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div id="mobile-nav" className="lg:hidden mt-4 pb-4 border-t border-dark-border bg-dark-card/50 rounded-lg p-4">
            <div className="flex flex-col space-y-4">
              {navItems.map((link) => (
                <div key={link.id}>
                  {link.children && link.children.length > 0 ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setIsServicesOpen(!isServicesOpen)}
                        className="flex items-center justify-between w-full font-medium text-text-secondary hover:text-cyber-blue transition-colors"
                      >
                        <span>{link.label}</span>
                        <FaChevronDown
                          className={`text-xs transition-transform duration-300 ${
                            isServicesOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                      {isServicesOpen && (
                        <div className="ml-4 mt-2 space-y-2 pl-4 border-l-2 border-cyber-blue/30">
                          {services.map((service: MenuItem) => (
                            <Link
                              key={service.id || service.url}
                              href={service.url}
                              className="block text-sm text-text-muted hover:text-cyber-cyan transition-colors"
                              onClick={() => setIsMobileMenuOpen(false)}
                            >
                              {service.label}
                            </Link>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <Link
                      href={link.url}
                      className="block font-medium text-text-secondary hover:text-cyber-blue transition-colors"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {link.label}
                    </Link>
                  )}
                </div>
              ))}
              {settings.bookingUrl && (
                <a
                  href={settings.bookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Book a 30-min call (opens external calendar)"
                  className="btn-primary text-center mt-4"
                >
                  <span>Book a 30-min call</span>
                </a>
              )}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
