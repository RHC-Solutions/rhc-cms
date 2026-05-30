'use client';
import { useState, useEffect } from 'react';
import AdminShell from '@adminpanel/components/admin/AdminShell';
import { useToast } from '@adminpanel/components/admin/Toast';
import { motion } from 'framer-motion';
import { FaPlus, FaEdit, FaTrash, FaEye, FaEyeSlash, FaBriefcase, FaTimes, FaSave, FaUsers, FaDownload } from 'react-icons/fa';

interface Job {
  id: string;
  title: string;
  department: string;
  locationType: 'remote' | 'hybrid' | 'in-office';
  city?: string;
  country?: string;
  type: 'Full-time' | 'Part-time' | 'Contract' | 'Freelance';
  description: string;
  requirements: string;
  visible: boolean;
  postedDate: string;
  applicants?: number;
  createdBy?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export default function JobManagement() {
  const { addToast } = useToast();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<{
    title: string;
    department: string;
    locationType: 'remote' | 'hybrid' | 'in-office';
    city: string;
    country: string;
    type: 'Full-time' | 'Part-time' | 'Contract' | 'Freelance';
    description: string;
    requirements: string;
    visible: boolean;
  }>({
    title: '',
    department: '',
    locationType: 'remote',
    city: '',
    country: '',
    type: 'Full-time',
    description: '',
    requirements: '',
    visible: true
  });

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      const res = await fetch('/api/cms/jobs', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setJobs(data);
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImportJobs = async () => {
    const confirmImport = confirm('Import jobs from rhcsolutions.com/careers? This may add new positions.');
    if (!confirmImport) return;

    setSaving(true);
    try {
      const res = await fetch('/api/cms/jobs/import', {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        addToast('success', `Imported ${data.imported} new job(s)`);
        // Reload jobs
        fetchJobs();
      } else {
        addToast('error', 'Failed to import jobs');
      }
    } catch (error) {
      console.error('Import failed:', error);
      addToast('error', 'Failed to import jobs');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleVisibility = async (id: string) => {
    const job = jobs.find(j => j.id === id);
    if (!job) return;

    try {
      const res = await fetch('/api/cms/jobs', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...job,
          visible: !job.visible,
          updatedBy: 'admin',
        }),
      });
      if (res.ok) {
        setJobs(jobs.map(j => j.id === id ? { ...j, visible: !j.visible } : j));
      }
    } catch (error) {
      console.error('Failed to toggle visibility:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this job posting?')) return;

    try {
      const res = await fetch(`/api/cms/jobs?id=${id}`, { 
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        setJobs(jobs.filter(j => j.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete job:', error);
    }
  };

  const handleEdit = (job: Job) => {
    setEditingJob(job);
    setFormData({
      title: job.title,
      department: job.department,
      locationType: job.locationType,
      city: job.city || '',
      country: job.country || '',
      type: job.type,
      description: job.description,
      requirements: job.requirements,
      visible: job.visible
    });
    setShowCreateModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const method = editingJob ? 'PUT' : 'POST';
      const payload = editingJob 
        ? { ...editingJob, ...formData, updatedBy: 'admin' }
        : { ...formData, createdBy: 'admin', postedDate: new Date().toISOString().split('T')[0], applicants: 0 };

      const res = await fetch('/api/cms/jobs', {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const result = await res.json();
        if (editingJob) {
          setJobs(jobs.map(j => j.id === result.id ? result : j));
        } else {
          setJobs([...jobs, result]);
        }
        handleCloseModal();
        addToast('success', '✓ Job saved successfully!');
      } else {
        addToast('error', 'Failed to save job');
      }
    } catch (error) {
      console.error('Save failed:', error);
      addToast('error', 'Failed to save job');
    } finally {
      setSaving(false);
    }
  };

  const handleCloseModal = () => {
    setShowCreateModal(false);
    setEditingJob(null);
    setFormData({
      title: '',
      department: '',
      locationType: 'remote',
      city: '',
      country: '',
      type: 'Full-time',
      description: '',
      requirements: '',
      visible: true
    });
  };

  return (
    <AdminShell title="Job Management">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="heading-xl text-gradient mb-2">Job Postings</h1>
          <p className="text-text-secondary">Manage open positions and career opportunities</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleImportJobs}
            disabled={saving}
            className="btn-secondary flex items-center space-x-2"
          >
            <FaDownload />
            <span>{saving ? 'Importing...' : 'Import from Website'}</span>
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary flex items-center space-x-2"
          >
            <FaPlus />
            <span>Create New Job</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="card-cyber p-6">
          <FaBriefcase className="text-3xl text-cyber-green mb-3" />
          <h3 className="text-2xl font-bold text-text-primary">{jobs.length}</h3>
          <p className="text-text-secondary text-sm">Total Positions</p>
        </div>
        <div className="card-cyber p-6">
          <FaEye className="text-3xl text-cyber-cyan mb-3" />
          <h3 className="text-2xl font-bold text-text-primary">{jobs.filter(j => j.visible).length}</h3>
          <p className="text-text-secondary text-sm">Active & Visible</p>
        </div>
        <div className="card-cyber p-6">
          <FaEyeSlash className="text-3xl text-cyber-blue mb-3" />
          <h3 className="text-2xl font-bold text-text-primary">{jobs.filter(j => !j.visible).length}</h3>
          <p className="text-text-secondary text-sm">Hidden Positions</p>
        </div>
        <div className="card-cyber p-6">
          <FaPlus className="text-3xl text-cyber-purple mb-3" />
          <h3 className="text-2xl font-bold text-text-primary">{jobs.reduce((sum, j) => sum + (j.applicants || 0), 0)}</h3>
          <p className="text-text-secondary text-sm">Total Applicants</p>
        </div>
      </div>

      {/* Jobs Table */}
      <div className="card-cyber overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-text-muted">Loading jobs...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-dark-lighter">
                <tr>
                  <th className="text-left p-4 text-text-primary font-semibold">Position</th>
                  <th className="text-left p-4 text-text-primary font-semibold">Department</th>
                  <th className="text-left p-4 text-text-primary font-semibold">Location</th>
                  <th className="text-left p-4 text-text-primary font-semibold">Type</th>
                  <th className="text-left p-4 text-text-primary font-semibold">Creator</th>
                  <th className="text-left p-4 text-text-primary font-semibold">Status</th>
                  <th className="text-right p-4 text-text-primary font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job, idx) => (
                  <motion.tr
                    key={job.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="border-t border-dark-border hover:bg-dark-lighter transition-colors"
                  >
                    <td className="p-4 font-medium">{job.title}</td>
                    <td className="p-4 text-text-secondary">{job.department}</td>
                    <td className="p-4 text-text-secondary">
                      {job.locationType === 'remote' && '🌍 Remote'}
                      {job.locationType === 'hybrid' && `🏢 ${job.city}, ${job.country}`}
                      {job.locationType === 'in-office' && `📍 ${job.city}, ${job.country}`}
                    </td>
                    <td className="p-4">{job.type}</td>
                    <td className="p-4 text-text-muted text-sm">{job.createdBy || '—'}</td>
                    <td className="p-4">
                      <button
                        onClick={() => handleToggleVisibility(job.id)}
                        className={`flex items-center gap-2 px-3 py-1 rounded transition-colors ${
                          job.visible
                            ? 'bg-cyber-green/20 text-cyber-green'
                            : 'bg-text-muted/20 text-text-muted'
                        }`}
                      >
                        {job.visible ? <FaEye /> : <FaEyeSlash />}
                        <span className="text-sm">{job.visible ? 'Visible' : 'Hidden'}</span>
                      </button>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2 items-center">
                        <span className="px-3 py-1 rounded bg-dark-lighter border border-dark-border text-text-secondary flex items-center gap-2">
                          <FaUsers className="text-sm" />
                          <span className="text-sm">{job.applicants || 0}</span>
                        </span>
                        <button
                          onClick={() => handleEdit(job)}
                          className="btn-primary px-3 py-1 flex items-center gap-2"
                        >
                          <FaEdit /> Edit
                        </button>
                        <button
                          onClick={() => handleDelete(job.id)}
                          className="p-2 text-cyber-red hover:bg-cyber-red/20 rounded transition-colors"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-dark-card border-2 border-cyber-green rounded-xl p-8 max-w-3xl w-full my-8"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="heading-lg text-gradient">
                {editingJob ? 'Edit Job Posting' : 'Create New Job Posting'}
              </h2>
              <button onClick={handleCloseModal} className="text-text-secondary hover:text-cyber-red">
                <FaTimes className="text-2xl" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-text-primary font-semibold mb-2">
                  Job Title <span className="text-cyber-red">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  className="w-full bg-dark border-2 border-dark-border rounded-lg py-3 px-4 text-text-primary 
                           focus:border-cyber-green focus:outline-none"
                  placeholder="e.g., Senior Cloud Engineer"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-text-primary font-semibold mb-2">Department</label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData({...formData, department: e.target.value})}
                    className="w-full bg-dark border-2 border-dark-border rounded-lg py-3 px-4 text-text-primary"
                    placeholder="e.g., Cloud & Infrastructure"
                  />
                </div>

                <div>
                  <label className="block text-text-primary font-semibold mb-2">Location Type</label>
                  <select
                    value={formData.locationType}
                    onChange={(e) => setFormData({...formData, locationType: e.target.value as any})}
                    className="w-full bg-dark border-2 border-dark-border rounded-lg py-3 px-4 text-text-primary"
                  >
                    <option value="remote">Remote</option>
                    <option value="hybrid">Hybrid</option>
                    <option value="in-office">In Office</option>
                  </select>
                </div>

                <div>
                  <label className="block text-text-primary font-semibold mb-2">Employment Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value as any})}
                    className="w-full bg-dark border-2 border-dark-border rounded-lg py-3 px-4 text-text-primary"
                  >
                    <option>Full-time</option>
                    <option>Part-time</option>
                    <option>Contract</option>
                    <option>Freelance</option>
                  </select>
                </div>
              </div>

              {(formData.locationType === 'hybrid' || formData.locationType === 'in-office') && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-text-primary font-semibold mb-2">City</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({...formData, city: e.target.value})}
                      className="w-full bg-dark border-2 border-dark-border rounded-lg py-3 px-4 text-text-primary"
                      placeholder="e.g., New York"
                    />
                  </div>
                  <div>
                    <label className="block text-text-primary font-semibold mb-2">Country</label>
                    <input
                      type="text"
                      value={formData.country}
                      onChange={(e) => setFormData({...formData, country: e.target.value})}
                      className="w-full bg-dark border-2 border-dark-border rounded-lg py-3 px-4 text-text-primary"
                      placeholder="e.g., United States"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-text-primary font-semibold mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full bg-dark border-2 border-dark-border rounded-lg py-3 px-4 text-text-primary"
                  rows={4}
                  placeholder="Job description..."
                />
              </div>

              <div>
                <label className="block text-text-primary font-semibold mb-2">Requirements</label>
                <textarea
                  value={formData.requirements}
                  onChange={(e) => setFormData({...formData, requirements: e.target.value})}
                  className="w-full bg-dark border-2 border-dark-border rounded-lg py-3 px-4 text-text-primary font-mono text-sm"
                  rows={6}
                  placeholder="Enter requirements, one per line&#10;e.g.&#10;5+ years experience&#10;Strong communication skills&#10;Team player"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.visible}
                    onChange={(e) => setFormData({...formData, visible: e.target.checked})}
                    className="w-4 h-4"
                  />
                  <span className="text-text-primary">Visible on website</span>
                </label>
              </div>

              <div className="flex gap-4 pt-6">
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary flex items-center gap-2"
                >
                  <FaSave />
                  <span>{saving ? 'Saving...' : 'Save Job'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-6 py-3 border-2 border-dark-border rounded-lg text-text-secondary hover:border-text-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AdminShell>
  );
}
