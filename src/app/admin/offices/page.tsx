'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FaMapMarkerAlt, FaPlus, FaEdit, FaTrash, FaSave, FaTimes } from 'react-icons/fa';
import AdminShell from '@adminpanel/components/admin/AdminShell';
import { useToast } from '@adminpanel/components/admin/Toast';

interface Office {
  id: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  timezone: string;
  description: string;
  active: boolean;
  order?: number;
}

export default function OfficesAdmin() {
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Office | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<Partial<Office>>({});
  const [saving, setSaving] = useState(false);
  const { addToast } = useToast();

  // The API answers failures with { error }; fall back to the status code.
  const errorReason = async (response: Response) => {
    try {
      const data = await response.json();
      if (data?.error) return String(data.error);
    } catch {}
    return `HTTP ${response.status}`;
  };

  // Fetch offices
  useEffect(() => {
    const fetchOffices = async () => {
      try {
        const response = await fetch('/api/cms/offices');
        if (response.ok) {
          const data = await response.json();
          setOffices(data.sort((a: Office, b: Office) => (a.order ?? 0) - (b.order ?? 0)));
        } else {
          addToast('error', `Offices could not be loaded: ${await errorReason(response)}`, 6000);
        }
      } catch (error) {
        console.error('Failed to fetch offices:', error);
        addToast('error', 'Offices could not be loaded: the request did not reach the server.', 6000);
      } finally {
        setLoading(false);
      }
    };

    fetchOffices();
  }, []);

  useEffect(() => {
    if (!showForm) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowForm(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showForm]);

  const handleEditClick = (office: Office) => {
    setEditing(office);
    setFormData(office);
    setShowForm(true);
  };

  const handleNewClick = () => {
    setEditing(null);
    setFormData({
      city: '',
      country: '',
      lat: 0,
      lng: 0,
      timezone: 'UTC',
      description: '',
      active: true,
    });
    setShowForm(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? NaN : parseFloat(value)) : type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSave = async () => {
    if (!formData.city?.trim()) {
      addToast('error', 'Add a city before saving.', 5000);
      return;
    }
    if (!Number.isFinite(formData.lat) || !Number.isFinite(formData.lng)) {
      addToast('error', 'Latitude and longitude must both be numbers.', 5000);
      return;
    }
    setSaving(true);
    try {
      const method = editing ? 'PUT' : 'POST';
      const payload = editing ? { ...formData, id: editing.id } : formData;

      const response = await fetch('/api/cms/offices', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const updatedOffice = await response.json();
        if (editing) {
          setOffices(offices.map(o => o.id === updatedOffice.id ? updatedOffice : o));
        } else {
          setOffices([...offices, updatedOffice]);
        }
        setShowForm(false);
        setEditing(null);
        addToast('success', `${updatedOffice.city || 'Office'} saved.`);
      } else {
        addToast('error', `Office was not saved: ${await errorReason(response)}`, 6000);
      }
    } catch (error) {
      console.error('Failed to save office:', error);
      addToast('error', 'Office was not saved: the request did not reach the server.', 6000);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this office?')) return;

    try {
      const response = await fetch('/api/cms/offices', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (response.ok) {
        setOffices(offices.filter(o => o.id !== id));
        addToast('success', 'Office deleted.');
      } else {
        addToast('error', `Office was not deleted: ${await errorReason(response)}`, 6000);
      }
    } catch (error) {
      console.error('Failed to delete office:', error);
      addToast('error', 'Office was not deleted: the request did not reach the server.', 6000);
    }
  };

  if (loading) {
    return (
      <AdminShell title="Offices">
        <div className="text-center py-12 text-text-secondary">Loading offices...</div>
      </AdminShell>
    );
  }

  return (
    <AdminShell title="Offices">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="heading-xl">Offices</h1>
          <p className="text-text-secondary text-sm mt-1">Office locations shown on the world map.</p>
        </div>
        <button
          onClick={handleNewClick}
          className="btn-primary"
        >
          <FaPlus aria-hidden="true" /> Add Office
        </button>
      </div>

      {/* Office Form Modal */}
      {showForm && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={() => setShowForm(false)}
        >
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="office-form-title"
            className="card-dark p-0 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between sticky top-0 z-10 bg-dark-card px-6 py-4 border-b border-dark-border">
              <h2 id="office-form-title" className="heading-md">{editing ? 'Edit Office' : 'New Office'}</h2>
              <button
                onClick={() => setShowForm(false)}
                aria-label="Close"
                className="grid place-items-center w-8 h-8 rounded-lg text-text-secondary hover:text-text-primary hover:bg-dark-lighter transition-colors"
              >
                <FaTimes aria-hidden="true" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="office-city" className="block text-sm font-medium mb-1.5">City</label>
                  <input
                    id="office-city"
                    autoFocus
                    type="text"
                    name="city"
                    value={formData.city || ''}
                    onChange={handleInputChange}
                    className="input"
                  />
                </div>
                <div>
                  <label htmlFor="office-country" className="block text-sm font-medium mb-1.5">Country</label>
                  <input
                    id="office-country"
                    type="text"
                    name="country"
                    value={formData.country || ''}
                    onChange={handleInputChange}
                    className="input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="office-lat" className="block text-sm font-medium mb-1.5">Latitude</label>
                  <input
                    id="office-lat"
                    type="number"
                    name="lat"
                    step="0.0001"
                    placeholder="e.g., 40.7128"
                    value={Number.isFinite(formData.lat) ? formData.lat : ''}
                    onChange={handleInputChange}
                    className="input"
                  />
                </div>
                <div>
                  <label htmlFor="office-lng" className="block text-sm font-medium mb-1.5">Longitude</label>
                  <input
                    id="office-lng"
                    type="number"
                    name="lng"
                    step="0.0001"
                    placeholder="e.g., -74.0060"
                    value={Number.isFinite(formData.lng) ? formData.lng : ''}
                    onChange={handleInputChange}
                    className="input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="office-timezone" className="block text-sm font-medium mb-1.5">Timezone</label>
                  <input
                    id="office-timezone"
                    type="text"
                    name="timezone"
                    placeholder="e.g., EST"
                    value={formData.timezone || ''}
                    onChange={handleInputChange}
                    className="input"
                  />
                </div>
                <div>
                  <label htmlFor="office-description" className="block text-sm font-medium mb-1.5">Description</label>
                  <input
                    id="office-description"
                    type="text"
                    name="description"
                    value={formData.description || ''}
                    onChange={handleInputChange}
                    className="input"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="active"
                  id="office-active"
                  checked={formData.active ?? true}
                  onChange={handleInputChange}
                  className="w-4 h-4"
                />
                <label htmlFor="office-active" className="text-sm">Active</label>
              </div>

              <div className="flex gap-3 pt-4 border-t border-dark-border">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-primary flex-1"
                >
                  <FaSave aria-hidden="true" /> {saving ? 'Saving…' : 'Save Office'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Offices Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {offices.map((office, idx) => (
          <motion.div
            key={office.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="card-dark group relative"
          >
            {!office.active && (
              <div className="absolute top-3 right-3 bg-cyber-red/15 text-cyber-red px-2 py-0.5 rounded text-xs font-medium">
                Inactive
              </div>
            )}

            <div className="mb-4">
              <h2 className="heading-md mb-1">{office.city}</h2>
              <p className="text-text-secondary">{office.country}</p>
            </div>

            <div className="space-y-2 mb-4 text-sm">
              <p><span className="text-text-muted">Timezone:</span> <span className="text-text-primary font-mono">{office.timezone}</span></p>
              <p><span className="text-text-muted">Description:</span> <span className="text-text-secondary">{office.description}</span></p>
              <p><span className="text-text-muted">Coordinates:</span> <span className="text-text-primary font-mono text-xs">{office.lat.toFixed(4)}, {office.lng.toFixed(4)}</span></p>
            </div>

            <div className="flex gap-2 pt-4 border-t border-dark-border">
              <button
                onClick={() => handleEditClick(office)}
                aria-label={`Edit ${office.city}`}
                className="flex-1 btn-secondary"
              >
                <FaEdit aria-hidden="true" /> Edit
              </button>
              <button
                onClick={() => handleDelete(office.id)}
                aria-label={`Delete ${office.city}`}
                className="flex-1 btn-secondary text-cyber-red"
              >
                <FaTrash aria-hidden="true" /> Delete
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {offices.length === 0 && (
        <div className="text-center py-12 border border-dashed border-dark-border rounded-xl">
          <FaMapMarkerAlt className="text-3xl text-text-muted mx-auto mb-4" aria-hidden="true" />
          <p className="text-text-secondary mb-4">No offices configured yet</p>
          <button onClick={handleNewClick} className="btn-secondary">
            <FaPlus aria-hidden="true" /> Create First Office
          </button>
        </div>
      )}
    </AdminShell>
  );
}
