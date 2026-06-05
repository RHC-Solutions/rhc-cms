'use client';
import { useState, useEffect } from 'react';
import AdminShell from '@adminpanel/components/admin/AdminShell';
import { FaSave, FaPlus, FaTimes, FaLink, FaArrowUp, FaArrowDown, FaLinkedin, FaFacebook, FaInstagram, FaTelegram } from 'react-icons/fa';

interface Link {
  name: string;
  href: string;
}

interface FooterSection {
  id: string;
  title?: string;
  links?: Link[];
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
  legal?: Link[];
}

export default function FooterManagement() {
  const [sections, setSections] = useState<FooterSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchFooter();
  }, []);

  const fetchFooter = async () => {
    try {
      const res = await fetch('/api/cms/footer', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setSections(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Failed to fetch footer:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/cms/footer', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(sections),
      });

      if (res.ok) {
        setMessage('✓ Footer saved successfully');
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage('✗ Failed to save footer');
      }
    } catch (error) {
      console.error('Save error:', error);
      setMessage('✗ Error saving footer');
    } finally {
      setSaving(false);
    }
  };

  const updateSection = (index: number, updated: FooterSection) => {
    const newSections = [...sections];
    newSections[index] = updated;
    setSections(newSections);
  };

  const addLink = (sectionIndex: number) => {
    const section = sections[sectionIndex];
    if (!section.links) return;
    const updated = { ...section, links: [...section.links, { name: '', href: '' }] };
    updateSection(sectionIndex, updated);
  };

  const removeLink = (sectionIndex: number, linkIndex: number) => {
    const section = sections[sectionIndex];
    if (!section.links) return;
    const updated = { ...section, links: section.links.filter((_, i) => i !== linkIndex) };
    updateSection(sectionIndex, updated);
  };

  const updateLink = (sectionIndex: number, linkIndex: number, field: 'name' | 'href', value: string) => {
    const section = sections[sectionIndex];
    if (!section.links) return;
    const newLinks = [...section.links];
    newLinks[linkIndex] = { ...newLinks[linkIndex], [field]: value };
    updateSection(sectionIndex, { ...section, links: newLinks });
  };

  const moveLink = (sectionIndex: number, linkIndex: number, direction: 'up' | 'down') => {
    const section = sections[sectionIndex];
    if (!section.links) return;
    const newLinks = [...section.links];
    const targetIndex = direction === 'up' ? linkIndex - 1 : linkIndex + 1;
    
    if (targetIndex < 0 || targetIndex >= newLinks.length) return;
    
    [newLinks[linkIndex], newLinks[targetIndex]] = [newLinks[targetIndex], newLinks[linkIndex]];
    updateSection(sectionIndex, { ...section, links: newLinks });
  };

  if (loading) {
    return (
      <AdminShell title="Footer Management">
        <div className="text-center p-8">Loading...</div>
      </AdminShell>
    );
  }

  return (
    <AdminShell title="Footer Management">
      <div className="mb-8">
        <h1 className="heading-xl text-gradient mb-2">Footer Management</h1>
        <p className="text-text-secondary">Customize footer sections, links, and contact information</p>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg ${message.startsWith('✓') ? 'bg-emerald-900/30 border border-emerald-700 text-emerald-100' : 'bg-red-900/30 border border-red-700 text-red-100'}`}>
          {message}
        </div>
      )}

      <div className="space-y-6">
        {sections.map((section, sIndex) => (
          <div key={section.id} className="card-cyber p-6">
            <h2 className="heading-md text-gradient mb-4">{section.title || section.id}</h2>

            {/* Quick Links / Services */}
            {section.links && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <label className="block text-text-primary font-semibold">
                    Links
                    {section.id === 'services' && (
                      <span className="ml-2 text-xs text-cyber-green font-normal">
                        (Auto-synced from Menu → Services)
                      </span>
                    )}
                  </label>
                  {section.id !== 'services' && (
                    <button
                      type="button"
                      onClick={() => addLink(sIndex)}
                      className="btn-secondary px-3 py-1 text-sm flex items-center gap-2"
                    >
                      <FaPlus /> Add Link
                    </button>
                  )}
                </div>
                {section.id === 'services' ? (
                  <div className="bg-dark-lighter p-4 rounded-lg border border-dark-border">
                    <p className="text-text-muted text-sm mb-3">
                      Services are automatically synced from the top menu. To edit services, go to <strong>Menu</strong> and update the Services submenu items.
                    </p>
                    <div className="space-y-2">
                      {section.links.map((link, lIndex) => (
                        <div key={lIndex} className="flex items-center gap-2 text-sm">
                          <FaLink className="text-cyber-cyan" />
                          <span className="text-text-primary">{link.name}</span>
                          <span className="text-text-muted">→</span>
                          <span className="text-cyber-blue">{link.href}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {section.links.map((link, lIndex) => (
                      <div key={lIndex} className="flex gap-2 items-center">
                        <div className="flex flex-col gap-1">
                          <button
                            type="button"
                            onClick={() => moveLink(sIndex, lIndex, 'up')}
                            disabled={lIndex === 0}
                            className={`p-1 rounded transition-colors ${
                              lIndex === 0
                                ? 'text-text-muted cursor-not-allowed'
                                : 'text-cyber-cyan hover:bg-dark-lighter'
                            }`}
                            title="Move up"
                          >
                            <FaArrowUp size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveLink(sIndex, lIndex, 'down')}
                            disabled={lIndex === section.links!.length - 1}
                            className={`p-1 rounded transition-colors ${
                              lIndex === section.links!.length - 1
                                ? 'text-text-muted cursor-not-allowed'
                                : 'text-cyber-cyan hover:bg-dark-lighter'
                            }`}
                            title="Move down"
                          >
                            <FaArrowDown size={12} />
                          </button>
                        </div>
                        <input
                          type="text"
                          value={link.name}
                        onChange={(e) => updateLink(sIndex, lIndex, 'name', e.target.value)}
                        placeholder="Link name"
                        className="flex-1 bg-dark border border-dark-border rounded px-3 py-2 text-text-primary focus:outline-none focus:border-cyber-cyan"
                      />
                      <input
                        type="text"
                        value={link.href}
                        onChange={(e) => updateLink(sIndex, lIndex, 'href', e.target.value)}
                        placeholder="/path"
                        className="flex-1 bg-dark border border-dark-border rounded px-3 py-2 text-text-primary focus:outline-none focus:border-cyber-cyan"
                      />
                      <button
                        type="button"
                        onClick={() => removeLink(sIndex, lIndex)}
                        className="bg-cyber-red/20 hover:bg-cyber-red/30 text-cyber-red px-3 py-2 rounded transition-colors"
                      >
                        <FaTimes />
                      </button>
                    </div>
                  ))}
                </div>
                )}
              </div>
            )}

            {/* Contact Section */}
            {section.id === 'contact' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-text-primary font-semibold mb-2">Phone</label>
                  <input
                    type="text"
                    value={section.phone || ''}
                    onChange={(e) => updateSection(sIndex, { ...section, phone: e.target.value })}
                    className="w-full bg-dark border border-dark-border rounded px-4 py-2 text-text-primary focus:outline-none focus:border-cyber-cyan"
                  />
                </div>
                <div>
                  <label className="block text-text-primary font-semibold mb-2">Email</label>
                  <input
                    type="email"
                    value={section.email || ''}
                    onChange={(e) => updateSection(sIndex, { ...section, email: e.target.value })}
                    className="w-full bg-dark border border-dark-border rounded px-4 py-2 text-text-primary focus:outline-none focus:border-cyber-cyan"
                  />
                </div>
                <div>
                  <label className="block text-text-primary font-semibold mb-2">WhatsApp</label>
                  <input
                    type="text"
                    value={section.whatsapp || ''}
                    onChange={(e) => updateSection(sIndex, { ...section, whatsapp: e.target.value })}
                    className="w-full bg-dark border border-dark-border rounded px-4 py-2 text-text-primary focus:outline-none focus:border-cyber-cyan"
                  />
                </div>

                {/* Footer social icons — these four inputs map 1:1 to the icons rendered
                    in the public site footer, in this exact order. */}
                <div className="bg-dark-lighter border border-dark-border rounded-lg p-4">
                  <label className="block text-text-primary font-semibold mb-1">Footer social icons</label>
                  <p className="text-text-muted text-sm mb-4">
                    These are the icons shown in the site footer. Leave a field blank to hide that icon.
                  </p>
                  <div className="space-y-3">
                    {/* LinkedIn */}
                    <div className="flex items-center gap-3">
                      <FaLinkedin className="text-cyber-cyan text-xl shrink-0" title="LinkedIn" />
                      <input
                        type="url"
                        value={section.socials?.linkedin || ''}
                        onChange={(e) => updateSection(sIndex, { ...section, socials: { ...section.socials, linkedin: e.target.value } })}
                        placeholder="https://www.linkedin.com/company/your-company"
                        className="flex-1 bg-dark border border-dark-border rounded px-4 py-2 text-text-primary focus:outline-none focus:border-cyber-cyan"
                      />
                    </div>
                    {/* Facebook */}
                    <div className="flex items-center gap-3">
                      <FaFacebook className="text-cyber-cyan text-xl shrink-0" title="Facebook" />
                      <input
                        type="url"
                        value={section.socials?.facebook || ''}
                        onChange={(e) => updateSection(sIndex, { ...section, socials: { ...section.socials, facebook: e.target.value } })}
                        placeholder="https://www.facebook.com/your-page"
                        className="flex-1 bg-dark border border-dark-border rounded px-4 py-2 text-text-primary focus:outline-none focus:border-cyber-cyan"
                      />
                    </div>
                    {/* Instagram */}
                    <div className="flex items-center gap-3">
                      <FaInstagram className="text-cyber-cyan text-xl shrink-0" title="Instagram" />
                      <input
                        type="url"
                        value={section.socials?.instagram || ''}
                        onChange={(e) => updateSection(sIndex, { ...section, socials: { ...section.socials, instagram: e.target.value } })}
                        placeholder="https://www.instagram.com/your-handle"
                        className="flex-1 bg-dark border border-dark-border rounded px-4 py-2 text-text-primary focus:outline-none focus:border-cyber-cyan"
                      />
                    </div>
                    {/* Telegram — stored as a handle; rendered as https://t.me/<handle> */}
                    <div className="flex items-center gap-3">
                      <FaTelegram className="text-cyber-cyan text-xl shrink-0" title="Telegram" />
                      <input
                        type="text"
                        value={section.telegram || ''}
                        onChange={(e) => updateSection(sIndex, { ...section, telegram: e.target.value })}
                        placeholder="username (without @)"
                        className="flex-1 bg-dark border border-dark-border rounded px-4 py-2 text-text-primary focus:outline-none focus:border-cyber-cyan"
                      />
                    </div>
                    {section.telegram && (
                      <p className="text-xs text-text-muted pl-8">
                        Links to https://t.me/{section.telegram.replace(/^[@+]/, '')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Company Info Section */}
            {section.id === 'company-info' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-text-primary font-semibold mb-2">Description</label>
                  <textarea
                    value={section.description || ''}
                    onChange={(e) => updateSection(sIndex, { ...section, description: e.target.value })}
                    rows={3}
                    className="w-full bg-dark border border-dark-border rounded px-4 py-2 text-text-primary focus:outline-none focus:border-cyber-cyan"
                  />
                </div>
                <div>
                  <label className="block text-text-primary font-semibold mb-2">Copyright (use {'{year}'} for current year)</label>
                  <input
                    type="text"
                    value={section.copyright || ''}
                    onChange={(e) => updateSection(sIndex, { ...section, copyright: e.target.value })}
                    className="w-full bg-dark border border-dark-border rounded px-4 py-2 text-text-primary focus:outline-none focus:border-cyber-cyan"
                  />
                </div>
                {section.legal && (
                  <div>
                    <label className="block text-text-primary font-semibold mb-2">Legal Links</label>
                    <div className="space-y-2">
                      {section.legal.map((link, lIndex) => (
                        <div key={lIndex} className="flex gap-2">
                          <input
                            type="text"
                            value={link.name}
                            onChange={(e) => {
                              const newLegal = [...(section.legal || [])];
                              newLegal[lIndex] = { ...newLegal[lIndex], name: e.target.value };
                              updateSection(sIndex, { ...section, legal: newLegal });
                            }}
                            placeholder="Link name"
                            className="flex-1 bg-dark border border-dark-border rounded px-3 py-2 text-text-primary focus:outline-none focus:border-cyber-cyan"
                          />
                          <input
                            type="text"
                            value={link.href}
                            onChange={(e) => {
                              const newLegal = [...(section.legal || [])];
                              newLegal[lIndex] = { ...newLegal[lIndex], href: e.target.value };
                              updateSection(sIndex, { ...section, legal: newLegal });
                            }}
                            placeholder="/path"
                            className="flex-1 bg-dark border border-dark-border rounded px-3 py-2 text-text-primary focus:outline-none focus:border-cyber-cyan"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="btn-primary mt-8 w-full flex items-center justify-center gap-2"
      >
        <FaSave />
        {saving ? 'Saving...' : 'Save Footer'}
      </button>
    </AdminShell>
  );
}
