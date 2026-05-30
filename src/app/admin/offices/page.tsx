'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FaMapMarkerAlt, FaPlus, FaEdit, FaTrash, FaSave, FaTimes } from 'react-icons/fa';

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

  // Fetch offices
  useEffect(() => {
    const fetchOffices = async () => {
      try {
        const response = await fetch('/api/cms/offices');
        if (response.ok) {
          const data = await response.json();
          setOffices(data.sort((a: Office, b: Office) => (a.order ?? 0) - (b.order ?? 0)));
        }
      } catch (error) {
        console.error('Failed to fetch offices:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOffices();
  }, []);

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
      [name]: type === 'number' ? parseFloat(value) : type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSave = async () => {
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
      }
    } catch (error) {
      console.error('Failed to save office:', error);
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
      }
    } catch (error) {
      console.error('Failed to delete office:', error);
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-text-secondary">Loading offices...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="heading-lg flex items-center gap-3 mb-2">
            <FaMapMarkerAlt className="text-cyber-green" />
            Global Offices
          </h2>
          <p className="text-text-secondary">Manage office locations for the world map</p>
        </div>
        <button
          onClick={handleNewClick}
          className="btn-primary flex items-center gap-2"
        >
          <FaPlus /> Add Office
        </button>
      </div>

      {/* Office Form Modal */}
      {showForm && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowForm(false)}
        >
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            onClick={e => e.stopPropagation()}
            className="card-dark w-full max-w-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-6 sticky top-0 bg-dark-card p-6 border-b border-cyber-green/30">
              <h3 className="heading-md">{editing ? 'Edit Office' : 'New Office'}</h3>
              <button
                onClick={() => setShowForm(false)}
                className="text-text-secondary hover:text-cyber-red transition-colors"
              >
                <FaTimes size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  name="city"
                  placeholder="City"
                  value={formData.city || ''}
                  onChange={handleInputChange}
                  className="input-field"
                />
                <input
                  type="text"
                  name="country"
                  placeholder="Country"
                  value={formData.country || ''}
                  onChange={handleInputChange}
                  className="input-field"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <input
                  type="number"
                  name="lat"
                  placeholder="Latitude"
                  step="0.0001"
                  value={formData.lat || ''}
                  onChange={handleInputChange}
                  className="input-field"
                />
                <input
                  type="number"
                  name="lng"
                  placeholder="Longitude"
                  step="0.0001"
                  value={formData.lng || ''}
                  onChange={handleInputChange}
                  className="input-field"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  name="timezone"
                  placeholder="Timezone (e.g., EST)"
                  value={formData.timezone || ''}
                  onChange={handleInputChange}
                  className="input-field"
                />
                <input
                  type="text"
                  name="description"
                  placeholder="Description"
                  value={formData.description || ''}
                  onChange={handleInputChange}
                  className="input-field"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="active"
                  id="office-active"
                  checked={formData.active ?? true}
                  onChange={handleInputChange}
                  className="w-4 h-4 rounded border-cyber-green accent-cyber-green"
                />
                <label htmlFor="office-active" className="text-text-secondary">Active</label>
              </div>

              <div className="flex gap-3 pt-4 border-t border-cyber-green/30">
                <button
                  onClick={handleSave}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  <FaSave /> Save Office
                </button>
                <button
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
              <div className="absolute top-2 right-2 bg-cyber-red/20 text-cyber-red px-2 py-1 rounded text-xs">
                Inactive
              </div>
            )}

            <div className="mb-4">
              <h3 className="heading-md text-cyber-cyan mb-1">{office.city}</h3>
              <p className="text-text-secondary">{office.country}</p>
            </div>

            <div className="space-y-2 mb-4 text-sm">
              <p><span className="text-text-muted">Timezone:</span> <span className="text-cyber-green font-mono">{office.timezone}</span></p>
              <p><span className="text-text-muted">Description:</span> <span className="text-text-secondary">{office.description}</span></p>
              <p><span className="text-text-muted">Coordinates:</span> <span className="text-cyber-green font-mono text-xs">{office.lat.toFixed(4)}, {office.lng.toFixed(4)}</span></p>
            </div>

            <div className="flex gap-2 pt-4 border-t border-cyber-green/30">
              <button
                onClick={() => handleEditClick(office)}
                className="flex-1 btn-secondary flex items-center justify-center gap-2"
              >
                <FaEdit size={16} /> Edit
              </button>
              <button
                onClick={() => handleDelete(office.id)}
                className="flex-1 bg-cyber-red/10 hover:bg-cyber-red/20 border border-cyber-red/50 text-cyber-red px-4 py-2 rounded transition-colors flex items-center justify-center gap-2"
              >
                <FaTrash size={16} /> Delete
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {offices.length === 0 && (
        <div className="text-center py-12 border-2 border-dashed border-cyber-green/30 rounded">
          <FaMapMarkerAlt className="text-4xl text-text-muted mx-auto mb-4" />
          <p className="text-text-secondary mb-4">No offices configured yet</p>
          <button onClick={handleNewClick} className="btn-primary">
            Create First Office
          </button>
        </div>
      )}
    </div>
  );
}
