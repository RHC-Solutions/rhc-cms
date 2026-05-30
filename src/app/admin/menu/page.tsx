'use client';

import { useEffect, useState } from 'react';
import AdminShell from '@adminpanel/components/admin/AdminShell';
import { FaList, FaPlus, FaTrash, FaEye, FaEyeSlash, FaArrowUp, FaArrowDown, FaSave, FaChevronDown } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';

type MenuItem = {
  id: string;
  label: string;
  url: string;
  visible?: boolean;
  order?: number;
  children?: MenuItem[];
};

type MenuData = {
  navigation: MenuItem[];
};

interface CMSPage {
  id: string;
  title: string;
  slug: string;
  description?: string;
  category: string;
  status: 'draft' | 'published' | 'archived';
}

export default function MenuManagement() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [pages, setPages] = useState<CMSPage[]>([]);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [newItemLabel, setNewItemLabel] = useState('');
  const [newItemUrl, setNewItemUrl] = useState('');
  const [parentId, setParentId] = useState('');

  useEffect(() => {
    fetchMenu();
    fetchPages();
  }, []);

  const fetchPages = async () => {
    try {
      const res = await fetch('/api/cms/pages', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setPages(data);
      }
    } catch (error) {
      console.error('Failed to fetch pages:', error);
    }
  };

  const fetchMenu = async () => {
    try {
      const res = await fetch('/api/cms/settings', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        // Ensure all menu items and children have IDs
        const normalized = (data.navigation || []).map((item: MenuItem) => {
          const normalizedItem = {
            ...item,
            id: item.id || Date.now().toString() + Math.random(),
          };
          if (normalizedItem.children) {
            normalizedItem.children = normalizedItem.children.map((child: MenuItem, idx: number) => ({
              ...child,
              id: child.id || `${normalizedItem.id}-child-${idx}-${Date.now()}`,
            }));
          }
          return normalizedItem;
        });
        const sorted = [...normalized].sort((a, b) => (a.order || 0) - (b.order || 0));
        setMenu(sorted);
      }
    } catch (error) {
      console.error('Failed to fetch menu:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveMenu = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/cms/settings', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ navigation: menu }),
      });
      if (res.ok) {
        await fetchMenu();
      } else {
        console.error('Failed to save menu');
      }
    } catch (error) {
      console.error('Save failed:', error);
    } finally {
      setSaving(false);
    }
  };

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const toggleVisibility = (id: string, parentId?: string) => {
    if (parentId) {
      setMenu(menu.map(parent =>
        parent.id === parentId
          ? {
              ...parent,
              children: parent.children?.map(child =>
                child.id === id ? { ...child, visible: !child.visible } : child
              )
            }
          : parent
      ));
    } else {
      setMenu(menu.map(item =>
        item.id === id ? { ...item, visible: !item.visible } : item
      ));
    }
  };

  const moveItem = (id: string, direction: 'up' | 'down', parentId?: string) => {
    if (parentId) {
      // Move child item
      setMenu(menu.map(parent => {
        if (parent.id === parentId && parent.children) {
          const children = [...parent.children];
          const index = children.findIndex(item => item.id === id);
          if ((direction === 'up' && index === 0) || (direction === 'down' && index === children.length - 1)) {
            return parent;
          }
          const [item] = children.splice(index, 1);
          const newIndex = direction === 'up' ? index - 1 : index + 1;
          children.splice(newIndex, 0, item);
          
          children.forEach((item, idx) => {
            item.order = idx + 1;
          });

          return { ...parent, children };
        }
        return parent;
      }));
    } else {
      // Move parent item
      const index = menu.findIndex(item => item.id === id);
      if ((direction === 'up' && index === 0) || (direction === 'down' && index === menu.length - 1)) {
        return;
      }

      const newMenu = [...menu];
      const [item] = newMenu.splice(index, 1);
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      newMenu.splice(newIndex, 0, item);

      newMenu.forEach((item, idx) => {
        item.order = idx + 1;
      });

      setMenu(newMenu);
    }
  };

  const deleteItem = (id: string, parentId?: string) => {
    if (parentId) {
      setMenu(menu.map(parent =>
        parent.id === parentId
          ? {
              ...parent,
              children: (parent.children || []).filter(child => child.id !== id)
            }
          : parent
      ));
    } else {
      setMenu(menu.filter(item => item.id !== id));
    }
  };

  const updateItem = (id: string, field: string, value: string, parentId?: string) => {
    if (parentId) {
      setMenu(menu.map(parent =>
        parent.id === parentId
          ? {
              ...parent,
              children: parent.children?.map(child =>
                child.id === id ? { ...child, [field]: value } : child
              )
            }
          : parent
      ));
    } else {
      setMenu(menu.map(item =>
        item.id === id ? { ...item, [field]: value } : item
      ));
    }
  };

  const addMenuItem = () => {
    if (!newItemLabel.trim() || !newItemUrl.trim()) return;

    const newItem: MenuItem = {
      id: Date.now().toString(),
      label: newItemLabel,
      url: newItemUrl,
      visible: true,
      order: parentId ? 1 : menu.length + 1,
    };

    if (parentId) {
      setMenu(menu.map(parent => {
        if (parent.id === parentId) {
          const children = parent.children || [];
          children.forEach((child, idx) => {
            child.order = idx + 2;
          });
          return { ...parent, children: [newItem, ...children] };
        }
        return parent;
      }));
    } else {
      setMenu([...menu, newItem]);
    }

    setNewItemLabel('');
    setNewItemUrl('');
    setParentId('');
  };

  if (loading) {
    return (
      <AdminShell title="Menu Management">
        <div className="p-8 text-text-secondary">Loading menu...</div>
      </AdminShell>
    );
  }

  return (
    <AdminShell title="Menu Management">
      <div className="mb-8">
        <h1 className="heading-xl text-gradient mb-2">Top Menu Management</h1>
        <p className="text-text-secondary">Manage menu items with hierarchy, reorder, hide/show, and add new items</p>
      </div>

      {/* Add New Item Section */}
      <div className="card-cyber p-6 mb-8">
        <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
          <FaPlus /> Add New Menu Item
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-text-primary font-semibold mb-2">Parent Menu (Optional)</label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="w-full bg-dark border-2 border-dark-border rounded-lg px-3 py-2 text-text-primary"
            >
              <option value="">Top Level Item</option>
              {menu.map(item => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-text-primary font-semibold mb-2">Label</label>
            <input
              type="text"
              value={newItemLabel}
              onChange={(e) => setNewItemLabel(e.target.value)}
              placeholder="e.g., Blog, Resources"
              className="w-full bg-dark border-2 border-dark-border rounded-lg px-3 py-2 text-text-primary"
              onKeyPress={(e) => e.key === 'Enter' && addMenuItem()}
            />
          </div>
          <div>
            <label className="block text-text-primary font-semibold mb-2">Page</label>
            <select
              value={newItemUrl}
              onChange={(e) => {
                const selectedPage = pages.find(p => p.slug === e.target.value);
                setNewItemUrl(e.target.value);
                if (selectedPage && !newItemLabel.trim()) {
                  setNewItemLabel(selectedPage.title);
                }
              }}
              className="w-full bg-dark border-2 border-dark-border rounded-lg px-3 py-2 text-text-primary"
            >
              <option value="">Select a page...</option>
              {pages
                .filter(p => p.status === 'published')
                .sort((a, b) => {
                  const orderA = a.category === 'Main' ? 0 : 1;
                  const orderB = b.category === 'Main' ? 0 : 1;
                  return orderA - orderB || a.title.localeCompare(b.title);
                })
                .map(page => (
                  <option key={page.id} value={page.slug}>
                    {page.title} {page.category !== 'Main' ? `(${page.category})` : ''}
                  </option>
                ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={addMenuItem}
              disabled={!newItemLabel.trim() || !newItemUrl.trim()}
              className="w-full bg-neon-green text-dark font-bold py-2 px-4 rounded-lg hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Item
            </button>
          </div>
        </div>
      </div>

      {/* Menu Items List */}
      <div className="card-cyber p-6">
        <h2 className="text-xl font-bold text-text-primary mb-6 flex items-center gap-2">
          <FaList /> Menu Items ({menu.filter(item => item.visible).length} visible)
        </h2>

        <div className="space-y-3">
          <AnimatePresence>
            {menu.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                {/* Parent Item */}
                <div className={`bg-dark border-2 rounded-lg p-4 transition-all ${
                  item.visible ? 'border-neon-green/50 hover:border-neon-green' : 'border-dark-border opacity-60'
                }`}>
                  <div className="flex items-center justify-between gap-4">
                    {/* Order Number */}
                    <div className="font-bold text-neon-green text-lg w-8 text-center">
                      {index + 1}
                    </div>

                    {/* Item Details */}
                    <div className="flex-1 min-w-0">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={item.label}
                          onChange={(e) => updateItem(item.id, 'label', e.target.value)}
                          placeholder="Menu label"
                          className="bg-dark-card border border-dark-border rounded px-2 py-1 text-text-primary font-semibold"
                        />
                        <input
                          type="text"
                          value={item.url}
                          onChange={(e) => updateItem(item.id, 'url', e.target.value)}
                          placeholder="URL path"
                          className="bg-dark-card border border-dark-border rounded px-2 py-1 text-text-primary"
                        />
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {/* Visibility Toggle */}
                      <button
                        onClick={() => toggleVisibility(item.id)}
                        className="p-2 rounded-lg bg-dark-card hover:bg-dark-border transition-colors text-lg"
                        title={item.visible ? 'Hide item' : 'Show item'}
                      >
                        {item.visible ? (
                          <FaEye className="text-neon-green" />
                        ) : (
                          <FaEyeSlash className="text-text-muted" />
                        )}
                      </button>

                      {/* Move Up */}
                      <button
                        onClick={() => moveItem(item.id, 'up')}
                        disabled={index === 0}
                        className="p-2 rounded-lg bg-dark-card hover:bg-dark-border transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-lg"
                        title="Move up"
                      >
                        <FaArrowUp className="text-neon-cyan" />
                      </button>

                      {/* Move Down */}
                      <button
                        onClick={() => moveItem(item.id, 'down')}
                        disabled={index === menu.length - 1}
                        className="p-2 rounded-lg bg-dark-card hover:bg-dark-border transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-lg"
                        title="Move down"
                      >
                        <FaArrowDown className="text-neon-cyan" />
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="p-2 rounded-lg bg-dark-card hover:bg-neon-red/20 transition-colors text-lg text-neon-red"
                        title="Delete item"
                      >
                        <FaTrash />
                      </button>

                      {/* Expand Submenu */}
                      {item.children && item.children.length > 0 && (
                        <button
                          onClick={() => toggleExpanded(item.id)}
                          className="p-2 rounded-lg bg-dark-card hover:bg-dark-border transition-colors text-lg"
                          title="Toggle submenu"
                        >
                          <FaChevronDown
                            className={`text-neon-cyan transition-transform ${
                              expandedItems.has(item.id) ? 'rotate-180' : ''
                            }`}
                          />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Child Items */}
                  <AnimatePresence>
                    {expandedItems.has(item.id) && item.children && item.children.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-4 space-y-3 pl-12 border-l-2 border-neon-green/30"
                      >
                        {item.children
                          .sort((a, b) => (a.order || 0) - (b.order || 0))
                          .map((child, childIndex) => (
                            <motion.div
                              key={child.id || `${item.id}-child-${childIndex}`}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -10 }}
                              className={`bg-dark-card border rounded-lg p-3 transition-all ${
                                child.visible ? 'border-neon-cyan/30' : 'border-dark-border opacity-60'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                {/* Order Number */}
                                <div className="font-bold text-neon-cyan text-sm w-6 text-center">
                                  {childIndex + 1}
                                </div>

                                {/* Item Details */}
                                <div className="flex-1 min-w-0">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    <input
                                      type="text"
                                      value={child.label}
                                      onChange={(e) => updateItem(child.id, 'label', e.target.value, item.id)}
                                      placeholder="Submenu label"
                                      className="bg-dark border border-dark-border rounded px-2 py-1 text-text-primary text-sm"
                                    />
                                    <input
                                      type="text"
                                      value={child.url}
                                      onChange={(e) => updateItem(child.id, 'url', e.target.value, item.id)}
                                      placeholder="URL path"
                                      className="bg-dark border border-dark-border rounded px-2 py-1 text-text-primary text-sm"
                                    />
                                  </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-1">
                                  {/* Visibility Toggle */}
                                  <button
                                    onClick={() => toggleVisibility(child.id, item.id)}
                                    className="p-1.5 rounded-lg bg-dark hover:bg-dark-border transition-colors"
                                    title={child.visible ? 'Hide item' : 'Show item'}
                                  >
                                    {child.visible ? (
                                      <FaEye className="text-neon-cyan text-sm" />
                                    ) : (
                                      <FaEyeSlash className="text-text-muted text-sm" />
                                    )}
                                  </button>

                                  {/* Move Up */}
                                  <button
                                    onClick={() => moveItem(child.id, 'up', item.id)}
                                    disabled={childIndex === 0}
                                    className="p-1.5 rounded-lg bg-dark hover:bg-dark-border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Move up"
                                  >
                                    <FaArrowUp className="text-neon-cyan text-sm" />
                                  </button>

                                  {/* Move Down */}
                                  <button
                                    onClick={() => moveItem(child.id, 'down', item.id)}
                                    disabled={childIndex === (item.children?.length || 0) - 1}
                                    className="p-1.5 rounded-lg bg-dark hover:bg-dark-border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Move down"
                                  >
                                    <FaArrowDown className="text-neon-cyan text-sm" />
                                  </button>

                                  {/* Delete */}
                                  <button
                                    onClick={() => deleteItem(child.id, item.id)}
                                    className="p-1.5 rounded-lg bg-dark hover:bg-neon-red/20 transition-colors text-neon-red"
                                    title="Delete item"
                                  >
                                    <FaTrash className="text-sm" />
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Save Button */}
      <div className="mt-8 flex justify-end">
        <button
          onClick={saveMenu}
          disabled={saving}
          className="flex items-center gap-2 bg-neon-green text-dark font-bold py-3 px-8 rounded-lg hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FaSave /> {saving ? 'Saving...' : 'Save Menu'}
        </button>
      </div>
    </AdminShell>
  );
}
