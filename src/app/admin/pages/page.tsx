'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import AdminShell from '@adminpanel/components/admin/AdminShell';
import { useToast } from '@adminpanel/components/admin/Toast';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaEdit, FaEye, FaSearch, FaTimes, FaSave, FaExternalLinkAlt, 
  FaPlus, FaTrash, FaArrowUp, FaArrowDown, FaAlignLeft, FaAlignCenter, FaAlignRight,
  FaColumns, FaTh, FaQuoteRight, FaCode
} from 'react-icons/fa';
import Link from 'next/link';
import { BlockRenderer } from '@adminpanel/components/cms/BlockRenderer';

interface ContentBlock {
  id: string;
  type: 'heading' | 'paragraph' | 'image' | 'button' | 'list' | 'cards' | 'hero' | 'cta' | 'columns' | 'testimonial' | 'worldmap' | 'contactform' | 'servicescarousel' | 'testimonialscarousel' | 'clientsteaser' | 'aboutpreview' | 'ctasection' | 'richtext' | 'faq';
  props: any;
  order: number;
}

interface CMSPage {
  id: string;
  title: string;
  slug: string;
  description?: string;
  category: string;
  status: 'draft' | 'published' | 'archived';
  showInFooter?: boolean;
  blocks: ContentBlock[];
  seo?: {
    metaTitle?: string;
    metaDescription?: string;
    keywords?: string[];
  };
  createdBy?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

// Content blocks keep their primary text inside props, e.g. { text, level, align }
// for headings or { text } for paragraphs/lists. A few legacy rows stored props as a
// bare string; tolerate both on read and always normalise to an object on write so the
// align/level controls don't clobber the text — and so the public renderer, which reads
// props.text, keeps rendering after an edit.
function readProp(props: any, key: string): string {
  if (props && typeof props === 'object') return props[key] ?? '';
  if (typeof props === 'string') return props;
  return '';
}
function writeProp(props: any, key: string, value: string): Record<string, any> {
  const base = props && typeof props === 'object' ? props : {};
  return { ...base, [key]: value };
}

export default function CMSPagesEditor() {
  const { addToast } = useToast();
  const [pages, setPages] = useState<CMSPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [editingPage, setEditingPage] = useState<CMSPage | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchPages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/cms/pages', {
        credentials: 'include',
      });
      if (!res.ok) {
        console.error('Fetch /api/cms/pages failed with status:', res.status);
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setPages(data);
    } catch (error) {
      console.error('Failed to fetch pages:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  const handleEdit = useCallback((page: CMSPage) => {
    setEditingPage(JSON.parse(JSON.stringify(page))); // Deep clone
    setShowEditor(true);
    setSelectedBlockId(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (!editingPage) return;

    setSaving(true);
    try {
      const method = editingPage.id === 'new' ? 'POST' : 'PUT';
      const res = await fetch('/api/cms/pages', {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...editingPage,
          updatedBy: 'admin',
        }),
      });

      if (res.ok) {
        addToast('success', '✓ Page saved successfully!');
        setShowEditor(false);
        fetchPages();
      } else {
        addToast('error', 'Failed to save page');
      }
    } catch (error) {
      console.error('Save failed:', error);
      addToast('error', 'Failed to save page');
    } finally {
      setSaving(false);
    }
  }, [editingPage, addToast, fetchPages]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Are you sure you want to delete this page?')) return;

    try {
      const res = await fetch(`/api/cms/pages?id=${id}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) {
        setPages(pages.filter(p => p.id !== id));
      }
    } catch (error) {
      console.error('Delete failed:', error);
      addToast('error', 'Failed to delete page');
    }
  }, [pages, addToast]);

  const handleNewPage = useCallback(() => {
    setEditingPage({
      id: 'new',
      title: 'New Page',
      slug: '/new-page',
      category: 'Main',
      status: 'draft',
      blocks: [],
      createdBy: 'admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    setShowEditor(true);
  }, []);

  const updateBlock = useCallback((blockId: string, updates: Partial<ContentBlock>) => {
    if (!editingPage) return;
    
    setEditingPage({
      ...editingPage,
      blocks: editingPage.blocks.map(block =>
        block.id === blockId ? { ...block, ...updates } : block
      )
    });
  }, [editingPage]);

  const addBlock = useCallback((type: ContentBlock['type']) => {
    if (!editingPage) return;

    let props: any;

    switch (type) {
      case 'hero':
        props = { title: 'Hero Title', subtitle: 'Subtitle text', cta: { text: 'Get Started', url: '#' }, align: 'center' };
        break;
      case 'cards':
        props = { 
          cards: [
            { title: 'Card 1', description: 'Card description', icon: '🚀' },
            { title: 'Card 2', description: 'Card description', icon: '⚡' },
            { title: 'Card 3', description: 'Card description', icon: '🎯' }
          ],
          columns: 3
        };
        break;
      case 'cta':
        props = {
          title: 'Call to Action',
          description: 'Concise supporting text for your CTA.',
          cta: { text: 'Get Started', url: '/contact' },
          align: 'center'
        };
        break;
      case 'columns':
        props = { 
          columns: [
            { content: 'Column 1 content...' },
            { content: 'Column 2 content...' }
          ],
          numColumns: 2
        };
        break;
      case 'testimonial':
        props = { quote: 'Great service!', author: 'John Doe', role: 'CEO, Company' };
        break;
      case 'heading':
        props = { text: 'New Heading', level: 2, align: 'left' };
        break;
      case 'image':
        props = { url: '/uploads/image.jpg', alt: 'Image' };
        break;
      case 'button':
        props = { text: 'Button Text', url: '#' };
        break;
      case 'list':
        props = { items: ['Item 1', 'Item 2', 'Item 3'] };
        break;
      case 'richtext':
        props = { html: '<h2>Section Title</h2><p>Your content here...</p>' };
        break;
      case 'faq':
        props = {
          title: 'Frequently asked questions',
          items: [
            { question: 'Sample question 1?', answer: 'Sample answer 1.' },
            { question: 'Sample question 2?', answer: 'Sample answer 2.' },
          ],
        };
        break;
      case 'worldmap':
        props = {};
        break;
      case 'contactform':
        props = { title: 'Get In Touch' };
        break;
      case 'servicescarousel':
      case 'testimonialscarousel':
      case 'clientsteaser':
      case 'aboutpreview':
      case 'ctasection':
        props = {};
        break;
      default:
        props = { content: 'New paragraph text...' };
    }
    
    const newBlock: ContentBlock = {
      id: Date.now().toString(),
      type,
      props,
      order: editingPage.blocks.length + 1
    };
    
    setEditingPage({
      ...editingPage,
      blocks: [...editingPage.blocks, newBlock]
    });
  }, [editingPage]);

  const deleteBlock = useCallback((blockId: string) => {
    if (!editingPage) return;
    
    setEditingPage({
      ...editingPage,
      blocks: editingPage.blocks.filter(block => block.id !== blockId)
    });
  }, [editingPage]);

  const moveBlock = useCallback((blockId: string, direction: 'up' | 'down') => {
    if (!editingPage) return;
    
    const blocks = [...editingPage.blocks];
    const index = blocks.findIndex(b => b.id === blockId);
    
    if (direction === 'up' && index > 0) {
      [blocks[index], blocks[index - 1]] = [blocks[index - 1], blocks[index]];
    } else if (direction === 'down' && index < blocks.length - 1) {
      [blocks[index], blocks[index + 1]] = [blocks[index + 1], blocks[index]];
    }
    
    setEditingPage({ ...editingPage, blocks });
  }, [editingPage]);

  const renderBlockEditor = (block: ContentBlock) => {
    switch (block.type) {
      case 'hero':
        return (
          <div className="space-y-3">
            <input
              type="text"
              value={block.props.title || ''}
              onChange={(e) => updateBlock(block.id, { props: { ...block.props, title: e.target.value }})}
              placeholder="Hero title"
              className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-text-primary text-sm"
            />
            <input
              type="text"
              value={block.props.subtitle || ''}
              onChange={(e) => updateBlock(block.id, { props: { ...block.props, subtitle: e.target.value }})}
              placeholder="Hero subtitle"
              className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-text-primary text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={block.props.cta?.text || ''}
                onChange={(e) => updateBlock(block.id, { props: { ...block.props, cta: { ...block.props.cta, text: e.target.value }}})}
                placeholder="Button text"
                className="bg-dark border border-dark-border rounded px-3 py-2 text-text-primary text-sm"
              />
              <input
                type="text"
                value={block.props.cta?.url || ''}
                onChange={(e) => updateBlock(block.id, { props: { ...block.props, cta: { ...block.props.cta, url: e.target.value }}})}
                placeholder="Button URL"
                className="bg-dark border border-dark-border rounded px-3 py-2 text-text-primary text-sm"
              />
            </div>
          </div>
        );
      case 'heading':
        return (
          <input
            type="text"
            value={readProp(block.props, 'text')}
            onChange={(e) => updateBlock(block.id, { props: writeProp(block.props, 'text', e.target.value) })}
            placeholder="Heading text"
            className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-text-primary text-sm"
          />
        );
      case 'paragraph':
        return (
          <textarea
            value={readProp(block.props, 'text')}
            onChange={(e) => updateBlock(block.id, { props: writeProp(block.props, 'text', e.target.value) })}
            className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-text-primary text-sm min-h-20 resize-none"
            placeholder="Enter paragraph text..."
          />
        );
      case 'list':
        return (
          <div className="space-y-1">
            <textarea
              value={readProp(block.props, 'text')}
              onChange={(e) => updateBlock(block.id, { props: writeProp(block.props, 'text', e.target.value) })}
              className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-text-primary text-sm min-h-24 resize-y"
              placeholder={'One item per line:\nFirst point\nSecond point'}
            />
            <p className="text-xs text-text-muted">One list item per line.</p>
          </div>
        );
      case 'image':
        return (
          <div className="space-y-2">
            <input
              type="text"
              value={readProp(block.props, 'url')}
              onChange={(e) => updateBlock(block.id, { props: writeProp(block.props, 'url', e.target.value) })}
              placeholder="/uploads/image.jpg"
              className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-text-primary text-sm"
            />
            <input
              type="text"
              value={readProp(block.props, 'alt')}
              onChange={(e) => updateBlock(block.id, { props: writeProp(block.props, 'alt', e.target.value) })}
              placeholder="Alt text (accessibility & SEO)"
              className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-text-primary text-sm"
            />
          </div>
        );
      case 'button':
        return (
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={block.props.text || ''}
              onChange={(e) => updateBlock(block.id, { props: { ...block.props, text: e.target.value }})}
              placeholder="Button text"
              className="bg-dark border border-dark-border rounded px-3 py-2 text-text-primary text-sm"
            />
            <input
              type="text"
              value={block.props.url || ''}
              onChange={(e) => updateBlock(block.id, { props: { ...block.props, url: e.target.value }})}
              placeholder="URL"
              className="bg-dark border border-dark-border rounded px-3 py-2 text-text-primary text-sm"
            />
          </div>
        );
      case 'testimonial':
        return (
          <div className="space-y-2">
            <textarea
              value={block.props.quote || ''}
              onChange={(e) => updateBlock(block.id, { props: { ...block.props, quote: e.target.value }})}
              placeholder="Quote text..."
              className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-text-primary text-sm min-h-15 resize-none"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={block.props.author || ''}
                onChange={(e) => updateBlock(block.id, { props: { ...block.props, author: e.target.value }})}
                placeholder="Author"
                className="bg-dark border border-dark-border rounded px-3 py-2 text-text-primary text-sm"
              />
              <input
                type="text"
                value={block.props.role || ''}
                onChange={(e) => updateBlock(block.id, { props: { ...block.props, role: e.target.value }})}
                placeholder="Role"
                className="bg-dark border border-dark-border rounded px-3 py-2 text-text-primary text-sm"
              />
            </div>
          </div>
        );
      case 'cards': {
        const cards = Array.isArray(block.props?.cards) ? block.props.cards : [];
        const updateCards = (next: any[]) => updateBlock(block.id, { props: { ...block.props, cards: next }});
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-text-muted">
              <span>Cards ({cards.length})</span>
              <div className="flex items-center gap-2">
                <span>Columns</span>
                <input
                  type="number"
                  min={1}
                  max={4}
                  value={block.props?.columns || block.props?.numColumns || Math.min(cards.length || 3, 4)}
                  onChange={(e) => {
                    const value = Math.max(1, Math.min(4, parseInt(e.target.value) || 1));
                    updateBlock(block.id, { props: { ...block.props, columns: value }});
                  }}
                  className="w-16 bg-dark border border-dark-border rounded px-2 py-1 text-text-primary text-xs"
                />
              </div>
            </div>

            <div className="space-y-3">
              {cards.map((card: any, idx: number) => (
                <div key={idx} className="bg-dark-lighter border border-dark-border rounded p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs text-text-muted">
                    <span>Card {idx + 1}</span>
                    <button
                      onClick={() => updateCards(cards.filter((_: any, i: number) => i !== idx))}
                      className="text-cyber-red hover:text-red-400"
                    >
                      Remove
                    </button>
                  </div>
                  <input
                    type="text"
                    value={card.title || ''}
                    onChange={(e) => {
                      const next = cards.map((c: any, i: number) => i === idx ? { ...c, title: e.target.value } : c);
                      updateCards(next);
                    }}
                    placeholder="Card title"
                    className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-text-primary text-sm"
                  />
                  <textarea
                    value={card.description || ''}
                    onChange={(e) => {
                      const next = cards.map((c: any, i: number) => i === idx ? { ...c, description: e.target.value } : c);
                      updateCards(next);
                    }}
                    placeholder="Card description"
                    className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-text-primary text-sm min-h-15 resize-none"
                  />
                  <input
                    type="text"
                    value={card.icon || ''}
                    onChange={(e) => {
                      const next = cards.map((c: any, i: number) => i === idx ? { ...c, icon: e.target.value } : c);
                      updateCards(next);
                    }}
                    placeholder="Emoji or icon text"
                    className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-text-primary text-sm"
                  />
                </div>
              ))}
            </div>

            <button
              onClick={() => updateCards([...(cards || []), { title: 'New Card', description: 'Card description', icon: '⭐' }])}
              className="w-full bg-dark border border-dashed border-cyber-cyan text-cyber-cyan rounded py-2 text-sm hover:bg-dark-lighter"
            >
              + Add Card
            </button>
          </div>
        );
      }
      case 'cta':
        return (
          <div className="space-y-3">
            <input
              type="text"
              value={block.props.title || ''}
              onChange={(e) => updateBlock(block.id, { props: { ...block.props, title: e.target.value }})}
              placeholder="CTA title"
              className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-text-primary text-sm"
            />
            <textarea
              value={block.props.description || ''}
              onChange={(e) => updateBlock(block.id, { props: { ...block.props, description: e.target.value }})}
              placeholder="CTA description"
              className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-text-primary text-sm min-h-20 resize-none"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={block.props.cta?.text || ''}
                onChange={(e) => updateBlock(block.id, { props: { ...block.props, cta: { ...block.props.cta, text: e.target.value }}})}
                placeholder="Button text"
                className="bg-dark border border-dark-border rounded px-3 py-2 text-text-primary text-sm"
              />
              <input
                type="text"
                value={block.props.cta?.url || ''}
                onChange={(e) => updateBlock(block.id, { props: { ...block.props, cta: { ...block.props.cta, url: e.target.value }}})}
                placeholder="Button URL"
                className="bg-dark border border-dark-border rounded px-3 py-2 text-text-primary text-sm"
              />
            </div>
          </div>
        );
      case 'contactform':
        return (
          <input
            type="text"
            value={block.props.title || ''}
            onChange={(e) => updateBlock(block.id, { props: { ...block.props, title: e.target.value }})}
            placeholder="Form section title (optional)"
            className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-text-primary text-sm"
          />
        );
      case 'servicescarousel':
        return (
          <div className="space-y-3">
            <div className="text-text-muted text-sm mb-2">Services Carousel (displays all service pages)</div>
            <input
              type="text"
              value={block.props?.title || ''}
              onChange={(e) => updateBlock(block.id, { props: { ...block.props, title: e.target.value }})}
              placeholder="Optional section title"
              className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-text-primary text-sm"
            />
          </div>
        );
      case 'testimonialscarousel':
        return (
          <div className="space-y-3">
            <div className="text-text-muted text-sm mb-2">Testimonials Carousel (displays all testimonials)</div>
            <input
              type="text"
              value={block.props?.title || ''}
              onChange={(e) => updateBlock(block.id, { props: { ...block.props, title: e.target.value }})}
              placeholder="Optional section title"
              className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-text-primary text-sm"
            />
          </div>
        );
      case 'clientsteaser':
        return (
          <div className="space-y-3">
            <div className="text-text-muted text-sm mb-2">Clients Teaser (displays client logos/names)</div>
            <input
              type="text"
              value={block.props?.title || ''}
              onChange={(e) => updateBlock(block.id, { props: { ...block.props, title: e.target.value }})}
              placeholder="Optional section title"
              className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-text-primary text-sm"
            />
          </div>
        );
      case 'aboutpreview':
        return (
          <div className="space-y-3">
            <div className="text-text-muted text-sm mb-2">About Preview Section</div>
            <input
              type="text"
              value={block.props?.title || ''}
              onChange={(e) => updateBlock(block.id, { props: { ...block.props, title: e.target.value }})}
              placeholder="Optional section title"
              className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-text-primary text-sm"
            />
          </div>
        );
      case 'worldmap':
        return (
          <div className="space-y-3">
            <div className="text-text-muted text-sm mb-2">Interactive World Map</div>
            <input
              type="text"
              value={block.props?.title || ''}
              onChange={(e) => updateBlock(block.id, { props: { ...block.props, title: e.target.value }})}
              placeholder="Optional section title"
              className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-text-primary text-sm"
            />
          </div>
        );
      case 'ctasection':
        return (
          <div className="space-y-3">
            <div className="text-text-muted text-sm mb-2">Call-to-Action Section</div>
            <input
              type="text"
              value={block.props?.title || ''}
              onChange={(e) => updateBlock(block.id, { props: { ...block.props, title: e.target.value }})}
              placeholder="CTA title"
              className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-text-primary text-sm"
            />
            <textarea
              value={block.props?.description || ''}
              onChange={(e) => updateBlock(block.id, { props: { ...block.props, description: e.target.value }})}
              placeholder="CTA description"
              className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-text-primary text-sm min-h-20 resize-none"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={block.props?.cta?.text || ''}
                onChange={(e) => updateBlock(block.id, { props: { ...block.props, cta: { ...block.props?.cta, text: e.target.value }}})}
                placeholder="Button text"
                className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-text-primary text-sm"
              />
              <input
                type="text"
                value={block.props?.cta?.url || ''}
                onChange={(e) => updateBlock(block.id, { props: { ...block.props, cta: { ...block.props?.cta, url: e.target.value }}})}
                placeholder="Button URL"
                className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-text-primary text-sm"
              />
            </div>
          </div>
        );
      case 'richtext':
        return (
          <div className="space-y-2">
            <textarea
              value={block.props?.html || ''}
              onChange={(e) => updateBlock(block.id, { props: { ...block.props, html: e.target.value }})}
              placeholder="<h2>Title</h2><p>Content...</p>"
              className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-text-primary text-sm min-h-48 resize-y font-mono"
            />
            <p className="text-xs text-text-muted">HTML tags: &lt;h2&gt;, &lt;p&gt;, &lt;ul&gt;, &lt;ol&gt;, &lt;strong&gt;</p>
          </div>
        );
      case 'faq': {
        const items: { question: string; answer: string }[] = Array.isArray(block.props?.items) ? block.props.items : [];
        const setItems = (next: { question: string; answer: string }[]) =>
          updateBlock(block.id, { props: { ...block.props, items: next } });
        return (
          <div className="space-y-3">
            <input
              type="text"
              value={block.props?.title ?? ''}
              onChange={(e) => updateBlock(block.id, { props: { ...block.props, title: e.target.value } })}
              placeholder="Section heading (e.g. Frequently asked questions)"
              className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-text-primary text-sm"
            />
            {items.map((it, idx) => (
              <div key={idx} className="bg-dark-lighter border border-dark-border rounded p-3 space-y-2">
                <div className="flex items-center justify-between text-xs text-text-muted">
                  <span>Q&amp;A #{idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => setItems(items.filter((_, i) => i !== idx))}
                    className="text-cyber-red hover:text-red-400"
                  >
                    Remove
                  </button>
                </div>
                <input
                  type="text"
                  value={it.question}
                  onChange={(e) => setItems(items.map((x, i) => (i === idx ? { ...x, question: e.target.value } : x)))}
                  placeholder="Question"
                  className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-text-primary text-sm"
                />
                <textarea
                  value={it.answer}
                  onChange={(e) => setItems(items.map((x, i) => (i === idx ? { ...x, answer: e.target.value } : x)))}
                  placeholder="Answer"
                  className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-text-primary text-sm min-h-20 resize-y"
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() => setItems([...items, { question: '', answer: '' }])}
              className="w-full bg-dark border border-dashed border-cyber-cyan text-cyber-cyan rounded py-2 text-sm hover:bg-dark-lighter"
            >
              + Add Q&amp;A
            </button>
          </div>
        );
      }
      default:
        return <div className="text-text-muted text-sm">Complex block - edit via JSON</div>;
    }
  };

  const renderBlockPreview = (block: ContentBlock) => {
    const alignClass = 
      block.props?.align === 'center' ? 'text-center' :
      block.props?.align === 'right' ? 'text-right' : '';
    
    switch (block.type) {
      case 'hero':
        return (
          <div className={`bg-linear-to-r from-cyber-green/10 to-cyber-cyan/10 p-8 rounded ${alignClass}`}>
            <h1 className="text-4xl font-bold text-gradient mb-2">{block.props.title}</h1>
            <p className="text-xl text-text-secondary mb-4">{block.props.subtitle}</p>
            <button className="btn-primary">{block.props.cta?.text}</button>
          </div>
        );
      case 'heading':
        const level = block.props?.level || 2;
        return (
          <div className={`text-text-primary font-bold ${alignClass}`}>
            {level === 1 ? <div className="text-4xl">{block.props.text || block.props}</div> :
             level === 2 ? <div className="text-3xl">{block.props.text || block.props}</div> :
             <div className="text-2xl">{block.props.text || block.props}</div>}
          </div>
        );
      case 'paragraph':
        return <p className={`text-text-secondary ${alignClass}`}>{block.props}</p>;
      case 'button':
        return (
          <div className={alignClass}>
            <button className="btn-primary">{block.props.text}</button>
          </div>
        );
      case 'image':
        return (
          <div className={alignClass}>
            <div className="inline-block bg-dark-lighter p-4 rounded border border-cyber-green/30">
              <div className="text-4xl text-cyber-green">📷</div>
              <p className="text-xs text-text-muted mt-2">{block.props}</p>
            </div>
          </div>
        );
      case 'list':
        return <div className="text-text-secondary whitespace-pre-line">{block.props}</div>;
      case 'testimonial':
        return (
          <div className="bg-dark-card p-6 rounded border-l-4 border-cyber-green">
            <FaQuoteRight className="text-3xl text-cyber-green/30 mb-3" />
            <p className="text-text-primary italic mb-4">"{block.props.quote}"</p>
            <div className="text-text-secondary text-sm">
              <strong>{block.props.author}</strong> - {block.props.role}
            </div>
          </div>
        );
      case 'cards': {
        const cards = Array.isArray(block.props?.cards) ? block.props.cards : [];
        const columns = block.props?.columns || block.props?.numColumns || Math.min(Math.max(cards.length, 1), 4);
        return (
          <div className={`space-y-3 ${alignClass}`}>
            <div
              className="grid gap-4"
              style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
            >
              {cards.map((card: any, idx: number) => (
                <div key={idx} className="bg-dark-lighter border border-dark-border rounded p-4">
                  <div className="text-2xl mb-2">{card.icon || '🃏'}</div>
                  <div className="font-semibold text-text-primary mb-1">{card.title}</div>
                  <p className="text-sm text-text-secondary leading-relaxed">{card.description}</p>
                </div>
              ))}
            </div>
          </div>
        );
      }
      case 'cta':
        return (
          <div className={`bg-dark-lighter border border-cyber-cyan/30 rounded p-6 ${alignClass}`}>
            <h3 className="text-2xl font-bold text-gradient mb-2">{block.props.title}</h3>
            <p className="text-text-secondary mb-4">{block.props.description}</p>
            {block.props.cta?.text && (
              <button className="btn-primary">{block.props.cta.text}</button>
            )}
          </div>
        );
      case 'richtext':
        return (
          <div className="space-y-2">
            <label className="text-xs text-text-muted">HTML Content</label>
            <textarea
              value={block.props?.html || ''}
              onChange={(e) => updateBlock(block.id, { props: { ...block.props, html: e.target.value }})}
              placeholder="<h2>Title</h2><p>Content...</p>"
              className="w-full bg-dark border border-cyber-purple rounded px-3 py-2 text-text-primary text-sm min-h-48 resize-y font-mono"
            />
            <p className="text-xs text-text-muted">Use HTML tags: &lt;h2&gt;, &lt;p&gt;, &lt;ul&gt;, &lt;ol&gt;, &lt;strong&gt;</p>
          </div>
        );
      case 'faq': {
        const items: { question: string; answer: string }[] = Array.isArray(block.props?.items) ? block.props.items : [];
        const setItems = (next: { question: string; answer: string }[]) =>
          updateBlock(block.id, { props: { ...block.props, items: next } });
        return (
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-xs text-text-muted">Section Heading (optional)</label>
              <input
                type="text"
                value={block.props?.title ?? ''}
                onChange={(e) => updateBlock(block.id, { props: { ...block.props, title: e.target.value } })}
                placeholder="Frequently asked questions"
                className="w-full bg-dark border border-cyber-cyan rounded px-3 py-2 text-text-primary text-sm"
              />
            </div>
            <div className="space-y-3">
              {items.map((it, idx) => (
                <div key={idx} className="bg-dark-card p-3 rounded border border-dark-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-muted">Q&amp;A #{idx + 1}</span>
                    <button
                      onClick={() => setItems(items.filter((_, i) => i !== idx))}
                      className="text-xs text-cyber-red hover:underline"
                      type="button"
                    >
                      Remove
                    </button>
                  </div>
                  <input
                    type="text"
                    value={it.question}
                    onChange={(e) => setItems(items.map((x, i) => (i === idx ? { ...x, question: e.target.value } : x)))}
                    placeholder="Question"
                    className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-text-primary text-sm"
                  />
                  <textarea
                    value={it.answer}
                    onChange={(e) => setItems(items.map((x, i) => (i === idx ? { ...x, answer: e.target.value } : x)))}
                    placeholder="Answer"
                    className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-text-primary text-sm min-h-24 resize-y"
                  />
                </div>
              ))}
              <button
                onClick={() => setItems([...items, { question: '', answer: '' }])}
                className="px-3 py-1.5 bg-dark-card hover:bg-dark-lighter border border-cyber-cyan rounded text-cyber-cyan text-xs"
                type="button"
              >
                + Add Q&amp;A
              </button>
            </div>
            <p className="text-xs text-text-muted">Emits FAQPage JSON-LD for rich-result eligibility. Keep answers 1-4 sentences.</p>
          </div>
        );
      }
      case 'worldmap':
        return (
          <div className="bg-dark-card p-6 rounded border border-cyber-green/30 text-center">
            <div className="text-4xl text-cyber-green mb-2">🗺️</div>
            <p className="text-text-muted">Interactive World Map</p>
          </div>
        );
      case 'contactform':
        return (
          <div className="bg-dark-card p-6 rounded border border-cyber-cyan/30 text-center">
            <div className="text-4xl text-cyber-cyan mb-2">📝</div>
            <p className="text-text-muted">Contact Form</p>
            {block.props?.title && <p className="text-sm text-text-secondary mt-1">Title: {block.props.title}</p>}
          </div>
        );
      case 'servicescarousel':
        return (
          <div className="bg-dark-card p-6 rounded border border-cyber-green/30 text-center">
            <div className="text-4xl text-cyber-green mb-2">🚀</div>
            <p className="text-text-muted">Services Carousel</p>
          </div>
        );
      case 'testimonialscarousel':
        return (
          <div className="bg-dark-card p-6 rounded border border-cyber-cyan/30 text-center">
            <div className="text-4xl text-cyber-cyan mb-2">💬</div>
            <p className="text-text-muted">Testimonials Carousel</p>
          </div>
        );
      case 'clientsteaser':
        return (
          <div className="bg-dark-card p-6 rounded border border-cyber-green/30 text-center">
            <div className="text-4xl text-cyber-green mb-2">🤝</div>
            <p className="text-text-muted">Clients Teaser</p>
          </div>
        );
      case 'aboutpreview':
        return (
          <div className="bg-dark-card p-6 rounded border border-cyber-cyan/30 text-center">
            <div className="text-4xl text-cyber-cyan mb-2">ℹ️</div>
            <p className="text-text-muted">About Preview</p>
          </div>
        );
      case 'ctasection':
        return (
          <div className="bg-dark-card p-6 rounded border border-cyber-green/30 text-center">
            <div className="text-4xl text-cyber-green mb-2">📣</div>
            <p className="text-text-muted">CTA Section</p>
          </div>
        );
      default:
        return <div className="text-text-muted">Block type: {block.type}</div>;
    }
  };

  const filteredPages = useMemo(() => 
    pages.filter(page =>
      page.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      page.slug.toLowerCase().includes(searchTerm.toLowerCase())
    ),
    [pages, searchTerm]
  );

  return (
    <AdminShell title="CMS Pages">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="heading-xl text-gradient mb-2">Content Management</h1>
          <p className="text-text-secondary">Create and manage your site pages</p>
        </div>
        <button onClick={handleNewPage} className="btn-primary flex items-center space-x-2">
          <FaPlus />
          <span>New Page</span>
        </button>
      </div>

      {/* Search */}
      <div className="card-cyber p-6 mb-6">
        <div className="relative">
          <FaSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-text-secondary" />
          <input
            type="text"
            placeholder="Search pages..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-dark-card border-2 border-dark-border rounded-lg py-3 pl-12 pr-4 text-text-primary 
                     focus:border-cyber-green focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Pages Table */}
      {loading ? (
        <div className="text-center py-12 text-text-muted">Loading pages...</div>
      ) : (
        <div className="card-cyber p-0 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-dark-lighter text-text-secondary">
                <th className="text-left px-4 py-3">Title</th>
                <th className="text-left px-4 py-3">Slug</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Category</th>
                <th className="text-left px-4 py-3">Last Edited</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPages.map((page) => (
                <tr key={page.id} className="border-t border-dark-border hover:bg-dark-lighter/50">
                  <td className="px-4 py-3 font-medium text-text-primary">{page.title}</td>
                  <td className="px-4 py-3 font-mono text-text-muted">{page.slug}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      page.status === 'published' ? 'bg-cyber-green/20 text-cyber-green' :
                      page.status === 'draft' ? 'bg-yellow-500/20 text-yellow-500' :
                      'bg-text-muted/20 text-text-muted'
                    }`}>
                      {page.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">{page.category}</td>
                  <td className="px-4 py-3">{new Date(page.updatedAt).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end items-center gap-2">
                      <Link href={page.slug} target="_blank" className="p-2 text-cyber-cyan hover:bg-cyber-cyan/20 rounded transition-colors">
                        <FaExternalLinkAlt />
                      </Link>
                      <button onClick={() => handleEdit(page)} className="btn-primary px-3 py-1">
                        Edit
                      </button>
                      <button onClick={() => handleDelete(page.id)} className="p-2 text-cyber-red hover:bg-cyber-red/20 rounded transition-colors">
                        <FaTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* WYSIWYG Editor Modal */}
      <AnimatePresence>
        {showEditor && editingPage && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-dark border-2 border-cyber-green rounded-xl w-full max-w-7xl my-8"
            >
              {/* Editor Header */}
              <div className="border-b border-cyber-green/30 p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1 space-y-3">
                    <input
                      type="text"
                      value={editingPage.title}
                      onChange={(e) => setEditingPage({ ...editingPage, title: e.target.value })}
                      className="text-2xl font-bold text-gradient bg-transparent border-none outline-none w-full"
                      placeholder="Page Title"
                    />
                    <div className="grid grid-cols-3 gap-3">
                      <input
                        type="text"
                        value={editingPage.slug}
                        onChange={(e) => setEditingPage({ ...editingPage, slug: e.target.value })}
                        className="bg-dark-card border border-dark-border rounded px-3 py-2 text-text-primary text-sm"
                        placeholder="/page-url"
                      />
                      <select
                        value={editingPage.status}
                        onChange={(e) => setEditingPage({ ...editingPage, status: e.target.value as any })}
                        className="bg-dark-card border border-dark-border rounded px-3 py-2 text-text-primary text-sm"
                      >
                        <option value="draft">Draft</option>
                        <option value="published">Published</option>
                        <option value="archived">Archived</option>
                      </select>
                      <input
                        type="text"
                        value={editingPage.category}
                        onChange={(e) => setEditingPage({ ...editingPage, category: e.target.value })}
                        className="bg-dark-card border border-dark-border rounded px-3 py-2 text-text-primary text-sm"
                        placeholder="Category"
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="showInFooter"
                        checked={editingPage.showInFooter || false}
                        onChange={(e) => setEditingPage({ ...editingPage, showInFooter: e.target.checked })}
                        className="w-4 h-4 text-cyber-cyan bg-dark-card border-dark-border rounded focus:ring-cyber-cyan focus:ring-2"
                      />
                      <label htmlFor="showInFooter" className="text-sm text-text-secondary">
                        Show in Footer (Legal Pages)
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4 ml-4">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="btn-primary flex items-center space-x-2"
                    >
                      <FaSave />
                      <span>{saving ? 'Saving...' : 'Save'}</span>
                    </button>
                    <button
                      onClick={() => setShowEditor(false)}
                      className="text-text-secondary hover:text-cyber-red transition-colors"
                    >
                      <FaTimes className="text-2xl" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Editor Content */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 min-h-150">
                {/* Editor Panel */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-text-primary">Content Blocks</h3>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => addBlock('hero')} className="px-2 py-1 bg-dark-card hover:bg-dark-lighter border border-cyber-green rounded text-cyber-green text-xs">
                        Hero
                      </button>
                      <button onClick={() => addBlock('heading')} className="px-2 py-1 bg-dark-card hover:bg-dark-lighter border border-cyber-cyan rounded text-cyber-cyan text-xs">
                        Heading
                      </button>
                      <button onClick={() => addBlock('paragraph')} className="px-2 py-1 bg-dark-card hover:bg-dark-lighter border border-dark-border rounded text-text-secondary text-xs">
                        Text
                      </button>
                      <button onClick={() => addBlock('richtext')} className="px-2 py-1 bg-dark-card hover:bg-dark-lighter border border-cyber-purple rounded text-cyber-purple text-xs">
                        Rich Text
                      </button>
                      <button onClick={() => addBlock('faq')} className="px-2 py-1 bg-dark-card hover:bg-dark-lighter border border-cyber-cyan rounded text-cyber-cyan text-xs">
                        FAQ
                      </button>
                      <button onClick={() => addBlock('button')} className="px-2 py-1 bg-dark-card hover:bg-dark-lighter border border-dark-border rounded text-text-secondary text-xs">
                        Button
                      </button>
                      <button onClick={() => addBlock('cards')} className="px-2 py-1 bg-dark-card hover:bg-dark-lighter border border-dark-border rounded text-text-secondary text-xs">
                        Cards
                      </button>
                      <button onClick={() => addBlock('cta')} className="px-2 py-1 bg-dark-card hover:bg-dark-lighter border border-dark-border rounded text-text-secondary text-xs">
                        CTA
                      </button>
                      <button onClick={() => addBlock('testimonial')} className="px-2 py-1 bg-dark-card hover:bg-dark-lighter border border-dark-border rounded text-text-secondary text-xs">
                        <FaQuoteRight className="inline mr-1" />
                        Quote
                      </button>
                      <button onClick={() => addBlock('worldmap')} className="px-2 py-1 bg-dark-card hover:bg-dark-lighter border border-dark-border rounded text-text-secondary text-xs">
                        World Map
                      </button>
                      <button onClick={() => addBlock('contactform')} className="px-2 py-1 bg-dark-card hover:bg-dark-lighter border border-dark-border rounded text-text-secondary text-xs">
                        Contact Form
                      </button>
                      <button onClick={() => addBlock('servicescarousel')} className="px-2 py-1 bg-dark-card hover:bg-dark-lighter border border-dark-border rounded text-text-secondary text-xs">
                        Services
                      </button>
                      <button onClick={() => addBlock('testimonialscarousel')} className="px-2 py-1 bg-dark-card hover:bg-dark-lighter border border-dark-border rounded text-text-secondary text-xs">
                        Testimonials
                      </button>
                      <button onClick={() => addBlock('clientsteaser')} className="px-2 py-1 bg-dark-card hover:bg-dark-lighter border border-dark-border rounded text-text-secondary text-xs">
                        Clients
                      </button>
                      <button onClick={() => addBlock('aboutpreview')} className="px-2 py-1 bg-dark-card hover:bg-dark-lighter border border-dark-border rounded text-text-secondary text-xs">
                        About
                      </button>
                      <button onClick={() => addBlock('ctasection')} className="px-2 py-1 bg-dark-card hover:bg-dark-lighter border border-dark-border rounded text-text-secondary text-xs">
                        CTA Section
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4 max-h-[calc(100vh-350px)] overflow-y-auto pr-2">
                    {editingPage.blocks.map((block, index) => (
                      <div
                        key={block.id}
                        className={`bg-dark-card border-2 rounded-lg p-4 ${
                          selectedBlockId === block.id ? 'border-cyber-green' : 'border-dark-border'
                        }`}
                        onClick={() => setSelectedBlockId(block.id)}
                      >
                        {/* Block Controls */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-mono text-text-muted uppercase">{block.type}</span>
                            {block.type === 'heading' && (
                              <select
                                value={block.props?.level || 2}
                                onChange={(e) => updateBlock(block.id, { props: { ...block.props, level: parseInt(e.target.value) }})}
                                className="text-xs bg-dark border border-dark-border rounded px-2 py-1 text-text-primary"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <option value={1}>H1</option>
                                <option value={2}>H2</option>
                                <option value={3}>H3</option>
                              </select>
                            )}
                          </div>
                          <div className="flex items-center space-x-1">
                            {/* Alignment */}
                            <button
                              onClick={(e) => { e.stopPropagation(); updateBlock(block.id, { props: { ...block.props, align: 'left' }}); }}
                              className={`p-1 rounded ${block.props?.align === 'left' || !block.props?.align ? 'bg-cyber-green/20 text-cyber-green' : 'text-text-muted hover:text-text-primary'}`}
                            >
                              <FaAlignLeft className="text-sm" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); updateBlock(block.id, { props: { ...block.props, align: 'center' }}); }}
                              className={`p-1 rounded ${block.props?.align === 'center' ? 'bg-cyber-green/20 text-cyber-green' : 'text-text-muted hover:text-text-primary'}`}
                            >
                              <FaAlignCenter className="text-sm" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); updateBlock(block.id, { props: { ...block.props, align: 'right' }}); }}
                              className={`p-1 rounded ${block.props?.align === 'right' ? 'bg-cyber-green/20 text-cyber-green' : 'text-text-muted hover:text-text-primary'}`}
                            >
                              <FaAlignRight className="text-sm" />
                            </button>
                            <div className="w-px h-4 bg-dark-border mx-1" />
                            {/* Move */}
                            <button
                              onClick={(e) => { e.stopPropagation(); moveBlock(block.id, 'up'); }}
                              disabled={index === 0}
                              className="p-1 text-cyber-cyan hover:bg-cyber-cyan/20 rounded disabled:opacity-30"
                            >
                              <FaArrowUp className="text-sm" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); moveBlock(block.id, 'down'); }}
                              disabled={index === editingPage.blocks.length - 1}
                              className="p-1 text-cyber-cyan hover:bg-cyber-cyan/20 rounded disabled:opacity-30"
                            >
                              <FaArrowDown className="text-sm" />
                            </button>
                            {/* Delete */}
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteBlock(block.id); }}
                              className="p-1 text-cyber-red hover:bg-cyber-red/20 rounded"
                            >
                              <FaTrash className="text-sm" />
                            </button>
                          </div>
                        </div>

                        {/* Block Editor */}
                        <div onClick={(e) => e.stopPropagation()}>
                          {renderBlockEditor(block)}
                        </div>
                      </div>
                    ))}
                    
                    {editingPage.blocks.length === 0 && (
                      <div className="text-center text-text-muted py-12">
                        <p>No content blocks yet</p>
                        <p className="text-sm mt-2">Click a button above to add content</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Live Preview Panel */}
                <div className="bg-dark-card rounded-lg p-8 border border-dark-border overflow-y-auto max-h-[calc(100vh-350px)]">
                  <div className="flex items-center justify-between mb-6 pb-4 border-b border-dark-border">
                    <h3 className="text-lg font-bold text-text-primary">Live Preview</h3>
                    <FaEye className="text-cyber-cyan" />
                  </div>
                  
                  <div className="space-y-6">
                    {editingPage.blocks.map((block) => (
                      <div
                        key={block.id}
                        className={`transition-all ${selectedBlockId === block.id ? 'ring-2 ring-cyber-green rounded p-2' : ''}`}
                      >
                        <BlockRenderer block={block} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AdminShell>
  );
}
