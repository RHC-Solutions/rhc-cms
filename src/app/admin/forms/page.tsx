'use client';
import { useCallback, useEffect, useState } from 'react';
import AdminShell from '@adminpanel/components/admin/AdminShell';
import { useToast } from '@adminpanel/components/admin/Toast';
import { FaDownload, FaTrash, FaEye, FaExternalLinkAlt, FaEdit, FaToggleOn, FaToggleOff, FaPlus, FaTimes } from 'react-icons/fa';

interface FormField {
  name: string;
  label: string;
  type: string;
  required: boolean;
}

interface FormVisibility {
  active: boolean;
  startDate: string | null;
  endDate: string | null;
  schedule: 'always' | 'scheduled';
}

interface FormDefinition {
  id: string;
  name: string;
  description: string;
  location: string;
  fields: FormField[];
  notifications: {
    email: boolean;
    telegram: boolean;
    whatsapp: boolean;
  };
  emailTo: string;
  enabled: boolean;
  visibility: FormVisibility;
  createdAt: string;
  updatedAt: string;
}

interface FormSubmission {
  id: string;
  formId: string;
  formName: string;
  data: Record<string, string>;
  email?: string;
  status: 'new' | 'reviewed' | 'replied';
  submittedAt: string;
  notes?: string;
}

export default function FormsManagement() {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<'forms' | 'submissions'>('forms');
  const [forms, setForms] = useState<Record<string, FormDefinition>>({});
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<FormSubmission | null>(null);
  const [filter, setFilter] = useState<'all' | 'new' | 'reviewed' | 'replied'>('all');
  const [editingForm, setEditingForm] = useState<FormDefinition | null>(null);
  const [isCreatingForm, setIsCreatingForm] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/cms/forms', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setForms(data.forms || {});
      setSubmissions(data.submissions || []);
    } catch (error) {
      console.error('Fetch failed', error);
      addToast('error', 'Failed to load forms data');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateStatus = async (id: string, status: FormSubmission['status']) => {
    try {
      const res = await fetch('/api/cms/forms/submissions', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error('Update failed');
      const updated = await res.json();
      setSubmissions((prev) => prev.map((s) => (s.id === id ? updated : s)));
      addToast('success', 'Status updated');
    } catch (error) {
      console.error('Update failed', error);
      addToast('error', 'Failed to update');
    }
  };

  const deleteSubmission = async (id: string) => {
    if (!confirm('Delete this submission?')) return;
    try {
      const res = await fetch('/api/cms/forms/submissions', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error('Delete failed');
      setSubmissions((prev) => prev.filter((s) => s.id !== id));
      addToast('success', 'Submission deleted');
    } catch (error) {
      console.error('Delete failed', error);
      addToast('error', 'Failed to delete');
      fetchData();
    }
  };

  const toggleFormEnabled = async (formId: string) => {
    try {
      const form = forms[formId];
      const res = await fetch('/api/cms/forms/settings', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formId, enabled: !form.enabled }),
      });
      if (!res.ok) throw new Error('Update failed');
      const updated = await res.json();
      setForms((prev) => ({ ...prev, [formId]: updated }));
      addToast('success', `Form ${updated.enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Toggle failed', error);
      addToast('error', 'Failed to update form');
    }
  };

  const saveForm = async () => {
    if (!editingForm) return;
    
    try {
      const res = await fetch('/api/cms/forms/save', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingForm),
      });
      if (!res.ok) throw new Error('Save failed');
      const saved = await res.json();
      setForms((prev) => ({ ...prev, [saved.id]: saved }));
      setEditingForm(null);
      setIsCreatingForm(false);
      addToast('success', `Form "${saved.name}" saved`);
    } catch (error) {
      console.error('Save failed', error);
      addToast('error', 'Failed to save form');
    }
  };

  const deleteForm = async (formId: string) => {
    if (!confirm(`Delete form "${forms[formId]?.name}"? This will NOT delete submissions.`)) return;
    
    try {
      const res = await fetch('/api/cms/forms/delete', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formId }),
      });
      if (!res.ok) throw new Error('Delete failed');
      setForms((prev) => {
        const newForms = { ...prev };
        delete newForms[formId];
        return newForms;
      });
      addToast('success', 'Form deleted');
    } catch (error) {
      console.error('Delete failed', error);
      addToast('error', 'Failed to delete form');
    }
  };

  const createNewForm = () => {
    const newId = `form_${Date.now()}`;
    setEditingForm({
      id: newId,
      name: 'New Form',
      description: '',
      location: '/new-form',
      fields: [
        { name: 'name', label: 'Name', type: 'text', required: true },
        { name: 'email', label: 'Email', type: 'email', required: true },
        { name: 'message', label: 'Message', type: 'textarea', required: true },
      ],
      notifications: { email: true, telegram: true, whatsapp: false },
      emailTo: 'admin@example.com',
      enabled: false,
      visibility: {
        active: true,
        startDate: null,
        endDate: null,
        schedule: 'always',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setIsCreatingForm(true);
  };

  const exportCSV = () => {
    const filtered = filter === 'all' ? submissions : submissions.filter((s) => s.status === filter);
    const rows = filtered.map((s) => [
      new Date(s.submittedAt).toISOString(),
      s.formName,
      s.email || '',
      ...Object.entries(s.data).map(([k, v]) => `${k}: ${v}`).join('; '),
      s.status,
    ]);
    const csv =
      ['Date', 'Form', 'Email', 'Data', 'Status'].join(',') +
      '\n' +
      rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `submissions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getFormSubmissions = (formId: string) => {
    return submissions.filter((s) => s.formId === formId);
  };

  const filtered = selectedFormId
    ? submissions.filter((s) => s.formId === selectedFormId && (filter === 'all' || s.status === filter))
    : filter === 'all'
    ? submissions
    : submissions.filter((s) => s.status === filter);

  const stats = {
    total: submissions.length,
    new: submissions.filter((s) => s.status === 'new').length,
    reviewed: submissions.filter((s) => s.status === 'reviewed').length,
    replied: submissions.filter((s) => s.status === 'replied').length,
  };

  return (
    <AdminShell title="Forms Management">
      <div className="mb-8">
        <h1 className="heading-xl text-gradient mb-2">Forms Management</h1>
        <p className="text-text-secondary">Manage forms and view submissions from your website</p>
      </div>

      <div className="flex space-x-4 mb-6 border-b border-dark-border">
        <button
          onClick={() => {
            setActiveTab('forms');
            setSelectedFormId(null);
          }}
          className={`px-6 py-3 font-semibold transition-colors ${
            activeTab === 'forms'
              ? 'text-cyber-green border-b-2 border-cyber-green'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Forms ({Object.keys(forms).length})
        </button>
        <button
          onClick={() => setActiveTab('submissions')}
          className={`px-6 py-3 font-semibold transition-colors ${
            activeTab === 'submissions'
              ? 'text-cyber-green border-b-2 border-cyber-green'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          All Submissions ({submissions.length})
        </button>
      </div>

      {/* Forms Tab */}
      {activeTab === 'forms' && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button
              onClick={createNewForm}
              className="btn-primary flex items-center gap-2"
            >
              <FaPlus />
              Create New Form
            </button>
          </div>

          {loading ? (
            <div className="text-text-secondary">Loading...</div>
          ) : Object.keys(forms).length === 0 ? (
            <div className="card-cyber p-8 text-center text-text-secondary">
              <p className="mb-4">No forms configured yet</p>
              <button
                onClick={createNewForm}
                className="btn-primary"
              >
                Create Your First Form
              </button>
            </div>
          ) : (
            Object.values(forms).map((form) => {
              const formSubmissions = getFormSubmissions(form.id);
              const newCount = formSubmissions.filter((s) => s.status === 'new').length;
              
              return (
                <div key={form.id} className="card-cyber p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-text-primary">{form.name}</h3>
                        <button
                          onClick={() => toggleFormEnabled(form.id)}
                          className={`flex items-center gap-2 px-3 py-1 rounded text-sm font-semibold ${
                            form.enabled
                              ? 'bg-cyber-green/20 text-cyber-green'
                              : 'bg-dark-lighter text-text-muted'
                          }`}
                        >
                          {form.enabled ? <FaToggleOn /> : <FaToggleOff />}
                          {form.enabled ? 'Enabled' : 'Disabled'}
                        </button>
                        {newCount > 0 && (
                          <span className="px-3 py-1 rounded-full bg-cyber-red/20 text-cyber-red text-xs font-bold">
                            {newCount} New
                          </span>
                        )}
                      </div>
                      <p className="text-text-secondary text-sm mb-3">{form.description}</p>
                      
                      {/* Visibility Status */}
                      <div className="mb-3 p-3 bg-dark-lighter rounded">
                        <p className="text-xs font-bold text-text-muted mb-2">VISIBILITY</p>
                        <div className="flex items-center gap-4 text-sm">
                          {form.visibility.schedule === 'scheduled' && form.visibility.startDate ? (
                            <>
                              <span className={form.visibility.active ? 'text-cyber-green' : 'text-cyber-red'}>
                                {form.visibility.active ? '✓ Active' : '✗ Inactive'}
                              </span>
                              <span className="text-text-muted">
                                {new Date(form.visibility.startDate).toLocaleDateString()} 
                                {form.visibility.endDate && ` → ${new Date(form.visibility.endDate).toLocaleDateString()}`}
                              </span>
                            </>
                          ) : (
                            <span className="text-cyber-green">✓ Always Active</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-text-muted mb-4">
                        <a
                          href={form.location}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 hover:text-cyber-blue transition-colors"
                        >
                          <FaExternalLinkAlt />
                          {form.location}
                        </a>
                        <span>•</span>
                        <span>{formSubmissions.length} submissions</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <button
                        onClick={() => setEditingForm(form)}
                        className="btn-secondary flex items-center gap-2 px-3 py-2"
                      >
                        <FaEdit />
                        Edit
                      </button>
                      <button
                        onClick={() => deleteForm(form.id)}
                        className="btn-secondary text-cyber-red px-3 py-2"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </div>

                  {/* Form Fields */}
                  <div className="bg-dark-lighter rounded p-4 mb-4">
                    <h4 className="text-sm font-bold text-text-primary mb-3">Form Fields ({form.fields.length}):</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {form.fields.map((field) => (
                        <div key={field.name} className="text-sm">
                          <span className="text-text-secondary">{field.label}</span>
                          {field.required && <span className="text-cyber-red ml-1">*</span>}
                          <div className="text-xs text-text-muted">{field.type}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Notifications */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-text-muted">Notifications:</span>
                      {form.notifications.email && (
                        <span className="px-2 py-1 rounded bg-cyber-blue/20 text-cyber-blue">
                          📧 Email
                        </span>
                      )}
                      {form.notifications.telegram && (
                        <span className="px-2 py-1 rounded bg-cyber-cyan/20 text-cyber-cyan">
                          📱 Telegram
                        </span>
                      )}
                      {form.notifications.whatsapp && (
                        <span className="px-2 py-1 rounded bg-cyber-green/20 text-cyber-green">
                          💬 WhatsApp
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setSelectedFormId(form.id);
                        setActiveTab('submissions');
                      }}
                      className="btn-secondary flex items-center gap-2"
                    >
                      <FaEye />
                      View Submissions
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Submissions Tab */}
      {activeTab === 'submissions' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {[
              { label: 'Total', value: stats.total, color: 'cyber-cyan' },
              { label: 'New', value: stats.new, color: 'cyber-green' },
              { label: 'Reviewed', value: stats.reviewed, color: 'cyber-yellow' },
              { label: 'Replied', value: stats.replied, color: 'cyber-red' },
            ].map((stat) => (
              <div key={stat.label} className="card-cyber p-6">
                <p className="text-text-secondary mb-2">{stat.label}</p>
                <p className={`text-3xl font-bold text-${stat.color}`}>{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="card-cyber p-6">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-bold">Submissions</h2>
                {selectedFormId && (
                  <>
                    <span className="text-text-muted">•</span>
                    <span className="text-cyber-blue">
                      {forms[selectedFormId]?.name}
                    </span>
                    <button
                      onClick={() => setSelectedFormId(null)}
                      className="text-sm text-text-muted hover:text-text-primary"
                    >
                      (View All)
                    </button>
                  </>
                )}
              </div>
              <button className="btn-secondary flex items-center space-x-2" onClick={exportCSV}>
                <FaDownload />
                <span>Export CSV</span>
              </button>
            </div>

            <div className="mb-4 flex space-x-2">
              {(['all', 'new', 'reviewed', 'replied'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-2 rounded text-sm font-semibold ${
                    filter === f
                      ? 'bg-cyber-green/30 text-cyber-green'
                      : 'bg-dark-lighter text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="text-text-secondary">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="text-text-secondary">No submissions yet</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-dark-lighter">
                    <tr>
                      <th className="text-left p-4 text-text-primary font-semibold">Date</th>
                      <th className="text-left p-4 text-text-primary font-semibold">Form</th>
                      <th className="text-left p-4 text-text-primary font-semibold">Email</th>
                      <th className="text-left p-4 text-text-primary font-semibold">Data</th>
                      <th className="text-left p-4 text-text-primary font-semibold">Status</th>
                      <th className="text-right p-4 text-text-primary font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((sub) => (
                      <tr
                        key={sub.id}
                        className="border-t border-dark-border hover:bg-dark-lighter cursor-pointer"
                        onClick={() => setSelectedSubmission(sub)}
                      >
                        <td className="p-4 text-text-secondary text-sm">
                          {new Date(sub.submittedAt).toLocaleString()}
                        </td>
                        <td className="p-4 text-text-primary font-semibold">{sub.formName}</td>
                        <td className="p-4 text-text-secondary text-sm">{sub.email || '—'}</td>
                        <td className="p-4 text-text-secondary text-sm max-w-xs truncate">
                          {Object.entries(sub.data)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(', ')}
                        </td>
                        <td className="p-4" onClick={(e) => e.stopPropagation()}>
                          <select
                            className="input-cyber text-sm py-1"
                            value={sub.status}
                            onChange={(e) => updateStatus(sub.id, e.target.value as any)}
                          >
                            <option value="new">New</option>
                            <option value="reviewed">Reviewed</option>
                            <option value="replied">Replied</option>
                          </select>
                        </td>
                        <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <button
                            className="text-cyber-red hover:bg-cyber-red/20 p-2 rounded"
                            onClick={() => deleteSubmission(sub.id)}
                          >
                            <FaTrash />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Submission Detail Modal */}
      {selectedSubmission && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedSubmission(null)}
        >
          <div
            className="card-cyber p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-gradient mb-2">
                  {selectedSubmission.formName}
                </h3>
                <p className="text-text-secondary text-sm">
                  {new Date(selectedSubmission.submittedAt).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedSubmission(null)}
                className="text-text-muted hover:text-text-primary text-2xl"
              >
                <FaTimes />
              </button>
            </div>

            <div className="space-y-4">
              {Object.entries(selectedSubmission.data).map(([key, value]) => (
                <div key={key} className="bg-dark-lighter rounded p-4">
                  <label className="text-sm font-bold text-text-muted uppercase mb-2 block">
                    {key}
                  </label>
                  <p className="text-text-primary whitespace-pre-wrap">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between pt-6 border-t border-dark-border">
              <div className="flex items-center gap-3">
                <span className="text-text-muted text-sm">Status:</span>
                <select
                  className="input-cyber"
                  value={selectedSubmission.status}
                  onChange={(e) => {
                    updateStatus(selectedSubmission.id, e.target.value as any);
                    setSelectedSubmission({ ...selectedSubmission, status: e.target.value as any });
                  }}
                >
                  <option value="new">New</option>
                  <option value="reviewed">Reviewed</option>
                  <option value="replied">Replied</option>
                </select>
              </div>
              <button
                onClick={() => {
                  deleteSubmission(selectedSubmission.id);
                  setSelectedSubmission(null);
                }}
                className="btn-secondary text-cyber-red flex items-center gap-2"
              >
                <FaTrash />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form Editor Modal */}
      {editingForm && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => {
            setEditingForm(null);
            setIsCreatingForm(false);
          }}
        >
          <div
            className="card-cyber p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gradient">
                {isCreatingForm ? 'Create New Form' : 'Edit Form'}
              </h3>
              <button
                onClick={() => {
                  setEditingForm(null);
                  setIsCreatingForm(false);
                }}
                className="text-text-muted hover:text-text-primary text-2xl"
              >
                <FaTimes />
              </button>
            </div>

            <div className="space-y-6">
              {/* Form Info */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-text-muted mb-2">Form Name *</label>
                  <input
                    type="text"
                    value={editingForm.name}
                    onChange={(e) => setEditingForm({ ...editingForm, name: e.target.value })}
                    className="input-cyber w-full"
                    placeholder="e.g., Contact Form"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-text-muted mb-2">Description</label>
                  <textarea
                    value={editingForm.description}
                    onChange={(e) => setEditingForm({ ...editingForm, description: e.target.value })}
                    className="input-cyber w-full"
                    placeholder="Brief description of this form"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-text-muted mb-2">Form Location *</label>
                    <input
                      type="text"
                      value={editingForm.location}
                      onChange={(e) => setEditingForm({ ...editingForm, location: e.target.value })}
                      className="input-cyber w-full"
                      placeholder="e.g., /contact"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-text-muted mb-2">Email Recipient</label>
                    <input
                      type="email"
                      value={editingForm.emailTo}
                      onChange={(e) => setEditingForm({ ...editingForm, emailTo: e.target.value })}
                      className="input-cyber w-full"
                    />
                  </div>
                </div>
              </div>

              {/* Visibility Settings */}
              <div className="border-t border-dark-border pt-6">
                <h4 className="text-lg font-bold text-text-primary mb-4">Visibility Settings</h4>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-text-muted mb-2">Schedule Type</label>
                    <select
                      value={editingForm.visibility.schedule}
                      onChange={(e) =>
                        setEditingForm({
                          ...editingForm,
                          visibility: {
                            ...editingForm.visibility,
                            schedule: e.target.value as 'always' | 'scheduled',
                          },
                        })
                      }
                      className="input-cyber w-full"
                    >
                      <option value="always">Always Active</option>
                      <option value="scheduled">Scheduled (Date Range)</option>
                    </select>
                  </div>

                  {editingForm.visibility.schedule === 'scheduled' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-text-muted mb-2">Start Date</label>
                        <input
                          type="datetime-local"
                          value={editingForm.visibility.startDate || ''}
                          onChange={(e) =>
                            setEditingForm({
                              ...editingForm,
                              visibility: {
                                ...editingForm.visibility,
                                startDate: e.target.value,
                              },
                            })
                          }
                          className="input-cyber w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-text-muted mb-2">End Date (Optional)</label>
                        <input
                          type="datetime-local"
                          value={editingForm.visibility.endDate || ''}
                          onChange={(e) =>
                            setEditingForm({
                              ...editingForm,
                              visibility: {
                                ...editingForm.visibility,
                                endDate: e.target.value,
                              },
                            })
                          }
                          className="input-cyber w-full"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Notifications */}
              <div className="border-t border-dark-border pt-6">
                <h4 className="text-lg font-bold text-text-primary mb-4">Notifications</h4>
                <div className="space-y-3">
                  {[
                    { key: 'email', label: 'Email', icon: '📧' },
                    { key: 'telegram', label: 'Telegram', icon: '📱' },
                    { key: 'whatsapp', label: 'WhatsApp', icon: '💬' },
                  ].map((notif) => (
                    <label key={notif.key} className="flex items-center gap-3 cursor-pointer p-3 bg-dark-lighter rounded">
                      <input
                        type="checkbox"
                        checked={editingForm.notifications[notif.key as keyof typeof editingForm.notifications]}
                        onChange={(e) =>
                          setEditingForm({
                            ...editingForm,
                            notifications: {
                              ...editingForm.notifications,
                              [notif.key]: e.target.checked,
                            },
                          })
                        }
                        className="w-4 h-4"
                      />
                      <span className="text-lg">{notif.icon}</span>
                      <span className="text-text-primary font-semibold">{notif.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-4 pt-6 border-t border-dark-border">
                <button
                  onClick={() => {
                    setEditingForm(null);
                    setIsCreatingForm(false);
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={saveForm}
                  className="btn-primary"
                >
                  Save Form
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
