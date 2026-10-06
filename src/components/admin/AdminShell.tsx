'use client';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import AdminSearch from './AdminSearch';
import { useToast } from './Toast';
import {
  ADMIN_NAV,
  ADMIN_NAV_SECTIONS,
  type AdminNavEntry,
  type AdminNavSection,
  type AdminRole,
} from '@adminpanel/lib/admin-nav';
import {
  FaHome, FaFileAlt, FaImages, FaUsers, FaCog, FaChartLine,
  FaBars, FaTimes, FaSignOutAlt, FaEdit, FaCookie, FaSearch, FaList, FaDatabase,
  FaPalette, FaListAlt, FaCloud, FaChevronDown, FaTrash, FaSpinner, FaShieldAlt,
  FaPlug, FaBullhorn, FaRobot, FaSyncAlt, FaHistory, FaStore, FaBoxOpen, FaShoppingCart, FaUserFriends,
  FaCalendarAlt, FaConciergeBell, FaCalendarCheck, FaClock, FaGift, FaLanguage, FaUser,
  FaExternalLinkAlt, FaAngleDoubleLeft, FaAngleDoubleRight,
} from 'react-icons/fa';
import type { IconType } from 'react-icons';

interface NavItem {
  name: string;
  href: string;
  icon: IconType;
  roles: AdminRole[];
  children?: NavItem[];
}

interface NavSection {
  label: AdminNavSection | null;
  items: NavItem[];
}

// Resolve admin-nav.ts iconName strings to components. The nav tree itself lives in
// src/lib/admin-nav.ts (shared with search) and carries no React imports.
const NAV_ICONS: Record<string, IconType> = {
  FaHome, FaChartLine, FaCog, FaFileAlt, FaBullhorn, FaStore, FaBoxOpen, FaShoppingCart,
  FaGift, FaUserFriends, FaCalendarAlt, FaCalendarCheck, FaConciergeBell, FaClock, FaImages,
  FaEdit, FaList, FaListAlt, FaPalette, FaLanguage, FaUsers, FaSearch, FaCookie, FaCloud,
  FaPlug, FaDatabase, FaRobot, FaSyncAlt, FaShieldAlt, FaHistory, FaUser,
};

interface AdminShellProps {
  children: React.ReactNode;
  title: string;
}

const SIDEBAR_KEY = 'adm-sidebar-collapsed';

export default function AdminShell({ children, title }: AdminShellProps) {
  const pathname = usePathname() || '';
  const { data: session } = useSession();
  const { addToast } = useToast();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [purgingCache, setPurgingCache] = useState(false);

  const role = (session?.user as any)?.role as AdminRole | undefined;

  // Sidebar groups, in ADMIN_NAV_SECTIONS order; entries without a section lead, unlabelled.
  const sections = useMemo<NavSection[]>(() => {
    const allowed = (n: AdminNavEntry) => !n.hidden && (role ? n.roles.includes(role) : true);
    const toItem = (n: AdminNavEntry): NavItem => ({
      name: n.name,
      href: n.href,
      roles: n.roles,
      icon: NAV_ICONS[n.iconName] || FaCog,
      children: n.children?.filter(allowed).map(toItem),
    });
    const visible = ADMIN_NAV.filter(allowed);
    return [null, ...ADMIN_NAV_SECTIONS]
      .map((label) => ({
        label,
        items: visible.filter((n) => (n.section ?? null) === label).map(toItem),
      }))
      .filter((section) => section.items.length > 0);
  }, [role]);

  // Remembered per browser; a convenience, so storage failures are ignored.
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(SIDEBAR_KEY) === '1');
    } catch {}
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      try {
        localStorage.setItem(SIDEBAR_KEY, prev ? '0' : '1');
      } catch {}
      return !prev;
    });
  };

  // Expand the parent of the current page.
  useEffect(() => {
    const expanded: string[] = [];
    for (const section of sections) {
      for (const item of section.items) {
        if (item.children?.length && (pathname === item.href || item.children.some((c) => pathname === c.href))) {
          expanded.push(item.name);
        }
      }
    }
    setExpandedItems(expanded);
  }, [pathname, sections]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileMenuOpen]);

  const toggleExpand = (itemName: string) => {
    setExpandedItems((prev) =>
      prev.includes(itemName) ? prev.filter((n) => n !== itemName) : [...prev, itemName]
    );
  };

  const handleLogout = async () => {
    const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';
    await signOut({ callbackUrl: `${base}/admin/login` });
  };

  const handlePurgeCache = async () => {
    if (!confirm('Purge the entire Cloudflare cache? Every page will be fetched from the server again until the cache refills.')) {
      return;
    }
    setPurgingCache(true);
    try {
      const response = await fetch('/api/cms/cloudflare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'purge-cache' }),
      });
      const data = await response.json();
      if (response.ok) {
        addToast('success', 'Cloudflare cache purged.');
      } else {
        addToast('error', `Cache purge failed: ${data.error || `HTTP ${response.status}`}`, 6000);
      }
    } catch (error) {
      console.error('Cache purge error:', error);
      addToast('error', 'Cache purge failed: the request did not reach the server.', 6000);
    } finally {
      setPurgingCache(false);
    }
  };

  const renderNav = (compact: boolean) => (
    <nav aria-label="Admin" className="px-3 py-3">
      {sections.map((section, si) => (
        <div key={section.label ?? si} className={si > 0 ? 'mt-4' : undefined}>
          {section.label &&
            (compact ? (
              <div className="mx-2 mb-2 border-t border-dark-border" aria-hidden="true" />
            ) : (
              <p className="px-3 mb-1 text-xs font-semibold uppercase tracking-[0.06em] text-text-muted">
                {section.label}
              </p>
            ))}
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              const hasChildren = !compact && !!item.children?.length;
              const childActive = !!item.children?.some((c) => pathname === c.href);
              const isExpanded = expandedItems.includes(item.name);
              const highlighted = isActive || (compact && childActive);

              return (
                <li key={item.name}>
                  <div className="relative flex items-center">
                    <Link
                      href={item.href}
                      aria-current={isActive ? 'page' : undefined}
                      title={compact ? item.name : undefined}
                      aria-label={compact ? item.name : undefined}
                      className={`flex flex-1 items-center gap-3 h-9 rounded-lg text-sm transition-colors ${
                        compact ? 'justify-center px-0' : 'px-3'
                      } ${hasChildren ? 'pr-9' : ''} ${
                        highlighted
                          ? 'bg-[var(--adm-accent-soft)] text-[var(--adm-accent)] font-medium'
                          : childActive
                          ? 'text-text-primary font-medium hover:bg-dark-lighter'
                          : 'text-text-secondary hover:text-text-primary hover:bg-dark-lighter'
                      }`}
                    >
                      <Icon className="text-[15px] shrink-0" aria-hidden="true" />
                      {!compact && <span className="truncate">{item.name}</span>}
                    </Link>
                    {hasChildren && (
                      <button
                        type="button"
                        onClick={() => toggleExpand(item.name)}
                        aria-expanded={isExpanded}
                        aria-label={`${isExpanded ? 'Hide' : 'Show'} ${item.name} pages`}
                        className="absolute right-1 top-1/2 -translate-y-1/2 grid place-items-center w-7 h-7 rounded-md text-text-muted hover:text-text-primary hover:bg-dark-lighter transition-colors"
                      >
                        <FaChevronDown
                          className={`text-[10px] transition-transform duration-150 ${isExpanded ? '' : '-rotate-90'}`}
                          aria-hidden="true"
                        />
                      </button>
                    )}
                  </div>
                  {hasChildren && isExpanded && (
                    <ul className="mt-0.5 mb-1 ml-[1.375rem] pl-3 border-l border-dark-border space-y-0.5">
                      {item.children!.map((child) => {
                        const isChildActive = pathname === child.href;
                        return (
                          <li key={child.href}>
                            <Link
                              href={child.href}
                              aria-current={isChildActive ? 'page' : undefined}
                              className={`flex items-center h-8 px-3 rounded-lg text-[13px] transition-colors ${
                                isChildActive
                                  ? 'bg-[var(--adm-accent-soft)] text-[var(--adm-accent)] font-medium'
                                  : 'text-text-secondary hover:text-text-primary hover:bg-dark-lighter'
                              }`}
                            >
                              <span className="truncate">{child.name}</span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const userName = session?.user?.name || session?.user?.email || '';

  return (
    <div className="adm min-h-screen">
      <a
        href="#adm-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-[var(--adm-accent)] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-[var(--adm-accent-ink)]"
      >
        Skip to content
      </a>

      {/* Top bar */}
      <header className="fixed inset-x-0 top-0 z-50 h-14 bg-[var(--adm-sidebar)] border-b border-dark-border">
        <div className="flex h-full items-center gap-3 px-3 sm:px-4">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((o) => !o)}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
            aria-controls="adm-drawer"
            className="lg:hidden grid place-items-center w-9 h-9 rounded-lg text-text-secondary hover:text-text-primary hover:bg-dark-lighter transition-colors"
          >
            {mobileMenuOpen ? <FaTimes aria-hidden="true" /> : <FaBars aria-hidden="true" />}
          </button>

          <Link href="/admin/dashboard" className="flex items-center gap-2 shrink-0 rounded-md">
            <span className="text-[15px] font-bold tracking-[-0.01em] text-text-primary">
              <span className="text-[var(--adm-accent)]">RHC</span> CMS
            </span>
          </Link>
          <span className="hidden sm:block h-5 w-px bg-dark-border" aria-hidden="true" />
          <p className="hidden sm:block min-w-0 truncate text-sm text-text-secondary">{title}</p>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <AdminSearch />
            <Link
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View site (opens in a new tab)"
              className="flex items-center gap-2 h-9 px-2.5 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-dark-lighter transition-colors"
            >
              <FaExternalLinkAlt className="text-xs" aria-hidden="true" />
              <span className="hidden md:inline">View site</span>
            </Link>
            {role === 'admin' && (
              <button
                type="button"
                onClick={handlePurgeCache}
                disabled={purgingCache}
                title="Purge the entire Cloudflare cache"
                aria-label="Purge Cloudflare cache"
                className="flex items-center gap-2 h-9 px-2.5 rounded-lg text-sm text-text-secondary hover:text-orange-300 hover:bg-orange-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {purgingCache ? <FaSpinner className="animate-spin" aria-hidden="true" /> : <FaTrash className="text-xs" aria-hidden="true" />}
                <span className="hidden xl:inline">Purge cache</span>
              </button>
            )}
            {session?.user && (
              <Link
                href="/admin/account"
                title="Account settings"
                aria-label={`Account settings${session.user.email ? ` for ${session.user.email}` : ''}`}
                className="hidden md:flex items-center gap-2 h-9 pl-2 pr-2.5 ml-1 rounded-lg border-l border-dark-border hover:bg-dark-lighter transition-colors"
              >
                <span
                  className="grid place-items-center w-8 h-8 rounded-full bg-[var(--adm-accent-soft)] text-[var(--adm-accent)] text-sm font-semibold"
                  aria-hidden="true"
                >
                  {userName.charAt(0).toUpperCase() || 'U'}
                </span>
                <span className="hidden xl:block max-w-[12rem] truncate text-sm text-text-primary">{session.user.name}</span>
              </Link>
            )}
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Log out"
              className="flex items-center gap-2 h-9 px-2.5 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-dark-lighter transition-colors"
            >
              <FaSignOutAlt aria-hidden="true" />
              <span className="hidden sm:inline">Log out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Sidebar, desktop */}
      <aside
        className={`hidden lg:flex flex-col fixed left-0 top-14 bottom-0 z-40 bg-[var(--adm-sidebar)] border-r border-dark-border transition-[width] duration-200 ${
          collapsed ? 'w-16' : 'w-60'
        }`}
      >
        <div className="flex-1 overflow-y-auto overscroll-contain">{renderNav(collapsed)}</div>
        <div className="border-t border-dark-border p-3">
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`flex w-full items-center gap-3 h-9 rounded-lg text-sm text-text-muted hover:text-text-primary hover:bg-dark-lighter transition-colors ${
              collapsed ? 'justify-center' : 'px-3'
            }`}
          >
            {collapsed ? <FaAngleDoubleRight aria-hidden="true" /> : <FaAngleDoubleLeft aria-hidden="true" />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Drawer, mobile */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 top-14 z-40">
          <button
            type="button"
            aria-label="Close menu"
            tabIndex={-1}
            onClick={() => setMobileMenuOpen(false)}
            className="absolute inset-0 bg-black/60"
          />
          <aside
            id="adm-drawer"
            className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] overflow-y-auto overscroll-contain bg-[var(--adm-sidebar)] border-r border-dark-border"
          >
            {renderNav(false)}
          </aside>
        </div>
      )}

      <div className={`pt-14 transition-[padding] duration-200 ${collapsed ? 'lg:pl-16' : 'lg:pl-60'}`}>
        <main id="adm-content" tabIndex={-1} className="adm-main mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 focus:outline-none">
          {children}
        </main>
      </div>
    </div>
  );
}
