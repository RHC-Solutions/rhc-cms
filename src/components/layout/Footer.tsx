'use client';
import Link from 'next/link';
import { FaLinkedin, FaFacebook, FaInstagram, FaPhone, FaEnvelope, FaTelegram, FaWhatsapp } from 'react-icons/fa';

type Settings = {
  siteName: string;
  tagline: string;
};

type ThemeBranding = {
  footerFont?: string;
  footerFontSize?: string;
};

interface LinkItem {
  name: string;
  href: string;
}

interface FooterSection {
  id: string;
  title?: string;
  links?: LinkItem[];
  phone?: string;
  email?: string;
  telegram?: string;
  whatsapp?: string;
  socials?: {
    linkedin?: string;
    facebook?: string;
    instagram?: string;
  };
  description?: string;
  copyright?: string;
  legal?: LinkItem[];
}

type FooterProps = {
  initialSettings?: Settings;
  initialBranding?: ThemeBranding;
  initialFooterData?: FooterSection[];
  initialFooterPages?: LinkItem[];
};

const DEFAULT_SETTINGS: Settings = { siteName: 'Your Site Name', tagline: 'Customize this tagline' };
const DEFAULT_BRANDING: ThemeBranding = {
  footerFont: 'Inter, system-ui, sans-serif',
  footerFontSize: '0.875rem',
};

export default function Footer({
  initialSettings,
  initialBranding,
  initialFooterData,
  initialFooterPages,
}: FooterProps = {}) {
  const currentYear = new Date().getFullYear();
  const settings: Settings = initialSettings || DEFAULT_SETTINGS;
  const branding: ThemeBranding = initialBranding || DEFAULT_BRANDING;
  const footerData: FooterSection[] = initialFooterData || [];
  const footerPages: LinkItem[] = initialFooterPages || [];

  const quickLinksSection = footerData.find((s) => s.id === 'quick-links');
  const servicesSection = footerData.find((s) => s.id === 'services');
  const contactSection = footerData.find((s) => s.id === 'contact');
  const companySection = footerData.find((s) => s.id === 'company-info');

  return (
    <footer 
      className="bg-dark-lighter border-t border-dark-border"
      style={{
        fontFamily: branding.footerFont || 'Inter, system-ui, sans-serif',
        fontSize: branding.footerFontSize || '0.875rem'
      }}
    >
      <div className="container-custom py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12">
          {/* Company Info */}
          <div>
            <h3 className="text-2xl font-bold mb-4 text-text-primary font-mono">
              {settings.siteName.split(' ').map((word, i) => (
                i === settings.siteName.split(' ').length - 1 ? 
                  <span key={i} className="text-gradient">{word}</span> :
                  <span key={i}>{word} </span>
              ))}
            </h3>
            <p className="text-sm text-cyber-green font-mono mb-3">
              &gt; {settings.tagline}
            </p>
            <p className="text-text-secondary mb-4">
              {companySection?.description || 'Since 1994, delivering professional IT consulting and services.'}
            </p>
          </div>

          {/* Quick Links */}
          {quickLinksSection && quickLinksSection.links && (
            <div>
              <h4 className="text-lg font-semibold mb-4 text-text-primary">{quickLinksSection.title}</h4>
              <ul className="space-y-2">
                {quickLinksSection.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-text-secondary hover:text-cyber-blue transition-colors"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Services */}
          {servicesSection && servicesSection.links && (
            <div>
              <h4 className="text-lg font-semibold mb-4 text-text-primary">{servicesSection.title}</h4>
              <ul className="space-y-2">
                {servicesSection.links.map((service) => (
                  <li key={service.href}>
                    <Link
                      href={service.href}
                      className="text-text-secondary hover:text-cyber-cyan transition-colors text-sm"
                    >
                      {service.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Contact Info */}
          {contactSection && (
            <div>
              <h4 className="text-lg font-semibold mb-4 text-text-primary">{contactSection.title}</h4>
              <ul className="space-y-3">
                {contactSection.phone && (
                  <li className="flex items-center space-x-2">
                    <FaPhone className="text-cyber-blue" />
                    <a href={`tel:${contactSection.phone}`} className="text-text-secondary hover:text-cyber-blue transition-colors">
                      {contactSection.phone}
                    </a>
                  </li>
                )}
                {contactSection.email && (
                  <li className="flex items-center space-x-2">
                    <FaEnvelope className="text-cyber-cyan" />
                    <a href={`mailto:${contactSection.email}`} className="text-text-secondary hover:text-cyber-cyan transition-colors">
                      {contactSection.email}
                    </a>
                  </li>
                )}
                {contactSection.telegram && (
                  <li className="flex items-center space-x-2">
                    <FaTelegram className="text-cyber-cyan" />
                    <a href={`https://t.me/${contactSection.telegram}`} className="text-text-secondary hover:text-cyber-cyan transition-colors text-sm">
                      {contactSection.telegram.startsWith('@') ? contactSection.telegram : `@${contactSection.telegram}`}
                    </a>
                  </li>
                )}
                {contactSection.whatsapp && (
                  <li className="flex items-center space-x-2">
                    <FaWhatsapp className="text-cyber-green" />
                    <a href={`https://wa.me/${contactSection.whatsapp}`} className="text-text-secondary hover:text-cyber-green transition-colors text-sm">
                      WhatsApp
                    </a>
                  </li>
                )}
              </ul>

              {/* Social Icons */}
              {contactSection.socials && (
                <div className="flex space-x-4 mt-6">
                  {contactSection.socials.linkedin && (
                    <a
                      href={contactSection.socials.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-2xl text-text-secondary hover:text-cyber-blue transition-all duration-300 hover:shadow-[0_0_10px_rgba(0,217,255,0.5)]"
                      aria-label="LinkedIn"
                    >
                      <FaLinkedin />
                    </a>
                  )}
                  {contactSection.socials.facebook && (
                    <a
                      href={contactSection.socials.facebook}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-2xl text-text-secondary hover:text-cyber-cyan transition-all duration-300 hover:shadow-[0_0_10px_rgba(0,240,255,0.5)]"
                      aria-label="Facebook"
                    >
                      <FaFacebook />
                    </a>
                  )}
                  {contactSection.socials.instagram && (
                    <a
                      href={contactSection.socials.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-2xl text-text-secondary hover:text-cyber-purple transition-all duration-300 hover:shadow-[0_0_10px_rgba(167,139,250,0.5)]"
                      aria-label="Instagram"
                    >
                      <FaInstagram />
                    </a>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-dark-border py-6">
        <div className="container-custom">
          <div className="flex flex-col md:flex-row justify-center items-center space-y-2 md:space-y-0">
            <div className="flex flex-wrap justify-center items-center gap-2 text-sm text-text-muted">
              <span>
                {companySection?.copyright ? companySection.copyright.replace('{year}', String(currentYear)) : `© ${currentYear} ${settings.siteName}. All rights reserved.`}
              </span>
              {footerPages.length > 0 && (
                <>
                  <span className="hidden md:inline">•</span>
                  {footerPages.map((page, index) => (
                    <span key={page.href} className="flex items-center">
                      <Link 
                        href={page.href} 
                        className="text-text-muted hover:text-cyber-cyan transition-colors"
                      >
                        {page.name}
                      </Link>
                      {index < footerPages.length - 1 && (
                        <span className="mx-2">•</span>
                      )}
                    </span>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
