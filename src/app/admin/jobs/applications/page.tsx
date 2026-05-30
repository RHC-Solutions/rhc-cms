'use client';
import { useState, useEffect } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import { motion } from 'framer-motion';
import { FaEnvelope, FaPhone, FaLinkedin, FaEye, FaCheck, FaTimes, FaFilter, FaSpinner, FaTrash } from 'react-icons/fa';

interface Application {
  id: string;
  jobId: string;
  jobTitle: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  linkedin: string;
  coverLetter: string;
  appliedDate: string;
  status: string;
  resumeFileName?: string;
}

export default function JobApplications() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterJob, setFilterJob] = useState('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/cms/jobs/applications');
      if (!response.ok) throw new Error('Failed to fetch applications');
      const data = await response.json();
      setApplications(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching applications:', err);
      setError('Failed to load applications');
      setApplications([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const response = await fetch('/api/cms/jobs/applications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: id, status: newStatus })
      });
      
      if (!response.ok) throw new Error('Failed to update status');
      
      setApplications(applications.map(app =>
        app.id === id ? { ...app, status: newStatus } : app
      ));
      
      if (selectedApplication?.id === id) {
        setSelectedApplication({ ...selectedApplication, status: newStatus });
      }
    } catch (err) {
      console.error('Error updating status:', err);
      alert('Failed to update application status');
    }
  };

  const handleDeleteApplication = async (id: string) => {
    if (!confirm('Are you sure you want to delete this application?')) return;
    
    try {
      const response = await fetch('/api/cms/jobs/applications', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: id })
      });
      
      if (!response.ok) throw new Error('Failed to delete');
      
      setApplications(applications.filter(app => app.id !== id));
      if (selectedApplication?.id === id) {
        setSelectedApplication(null);
      }
    } catch (err) {
      console.error('Error deleting application:', err);
      alert('Failed to delete application');
    }
  }

  const uniqueJobs = Array.from(new Set(applications.map(app => app.jobTitle)));
  const statuses = ['new', 'screening', 'interview', 'offer', 'hired', 'rejected'];

  const filteredApplications = applications.filter(app => {
    const statusMatch = filterStatus === 'All' || app.status === filterStatus.toLowerCase();
    const jobMatch = filterJob === 'All' || app.jobTitle === filterJob;
    return statusMatch && jobMatch;
  });

  const getStatusColor = (status: string) => {
    const lowerStatus = status.toLowerCase();
    switch (lowerStatus) {
      case 'new': return 'cyber-green';
      case 'screening': return 'cyber-cyan';
      case 'interview': return 'cyber-blue';
      case 'offer': return 'cyber-purple';
      case 'hired': return 'cyber-green';
      case 'rejected': return 'cyber-red';
      default: return 'text-muted';
    }
  };

  const getStatusLabel = (status: string) => {
    const lowerStatus = status.toLowerCase();
    return lowerStatus.charAt(0).toUpperCase() + lowerStatus.slice(1);
  };

  return (
    <AdminShell title="Job Applications">
      {/* Header */}
      <div className="mb-8">
        <h1 className="heading-xl text-gradient mb-2">Job Applications</h1>
        <p className="text-text-secondary">Review and manage real candidate applications</p>
      </div>

      {error && (
        <div className="bg-cyber-red/20 border-2 border-cyber-red rounded-lg p-4 mb-6">
          <p className="text-cyber-red font-semibold">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <FaSpinner className="text-3xl text-cyber-green animate-spin" />
          <span className="ml-3 text-text-secondary">Loading applications...</span>
        </div>
      ) : applications.length === 0 ? (
        <div className="card-cyber p-12 text-center">
          <p className="text-text-secondary text-lg">No applications yet. They will appear here when candidates apply through the careers page.</p>
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="card-cyber p-6">
              <h3 className="text-2xl font-bold text-text-primary">{applications.length}</h3>
              <p className="text-text-secondary text-sm">Total Applications</p>
            </div>
            <div className="card-cyber p-6">
              <h3 className="text-2xl font-bold text-cyber-green">{applications.filter(a => a.status === 'new').length}</h3>
              <p className="text-text-secondary text-sm">New</p>
            </div>
            <div className="card-cyber p-6">
              <h3 className="text-2xl font-bold text-cyber-blue">{applications.filter(a => a.status === 'interview').length}</h3>
              <p className="text-text-secondary text-sm">In Interview</p>
            </div>
            <div className="card-cyber p-6">
              <h3 className="text-2xl font-bold text-cyber-purple">{applications.filter(a => a.status === 'hired').length}</h3>
              <p className="text-text-secondary text-sm">Hired</p>
            </div>
          </div>

          {/* Filters */}
          <div className="card-cyber p-6 mb-6">
            <div className="flex items-center space-x-4">
              <FaFilter className="text-cyber-green" />
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-text-primary text-sm font-semibold mb-2">Filter by Status</label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full bg-dark-card border-2 border-dark-border rounded-lg px-4 py-2 text-text-primary 
                             focus:border-cyber-green focus:outline-none"
                  >
                    <option>All</option>
                    {statuses.map(status => (
                      <option key={status} value={status.toLowerCase()}>
                        {getStatusLabel(status)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-text-primary text-sm font-semibold mb-2">Filter by Position</label>
                  <select
                    value={filterJob}
                    onChange={(e) => setFilterJob(e.target.value)}
                    className="w-full bg-dark-card border-2 border-dark-border rounded-lg px-4 py-2 text-text-primary 
                             focus:border-cyber-cyan focus:outline-none"
                  >
                    <option>All</option>
                    {uniqueJobs.map(job => (
                      <option key={job}>{job}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Applications Table */}
          <div className="card-cyber overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-dark-lighter">
                  <tr>
                    <th className="text-left p-4 text-text-primary font-semibold">Candidate</th>
                    <th className="text-left p-4 text-text-primary font-semibold">Position</th>
                    <th className="text-left p-4 text-text-primary font-semibold">Contact</th>
                    <th className="text-left p-4 text-text-primary font-semibold">Applied</th>
                    <th className="text-left p-4 text-text-primary font-semibold">Status</th>
                    <th className="text-right p-4 text-text-primary font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredApplications.map((app, idx) => (
                    <motion.tr
                      key={app.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="border-t border-dark-border hover:bg-dark-lighter transition-colors"
                    >
                      <td className="p-4">
                        <div>
                          <p className="text-text-primary font-semibold">{app.firstName} {app.lastName}</p>
                          {app.linkedin && (
                            <a href={app.linkedin} target="_blank" rel="noopener noreferrer" 
                               className="text-cyber-blue text-sm hover:text-cyber-cyan flex items-center space-x-1">
                              <FaLinkedin />
                              <span>LinkedIn</span>
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-text-secondary text-sm">{app.jobTitle}</td>
                      <td className="p-4">
                        <div className="space-y-1 text-sm">
                          <a href={`mailto:${app.email}`} className="flex items-center space-x-2 text-text-secondary hover:text-cyber-cyan">
                            <FaEnvelope />
                            <span>{app.email}</span>
                          </a>
                          <div className="flex items-center space-x-2 text-text-secondary font-mono text-xs">
                            <FaPhone />
                            <span>{app.phone}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-text-secondary text-sm">
                        {new Date(app.appliedDate).toLocaleDateString()}
                      </td>
                      <td className="p-4">
                        <select
                          value={app.status}
                          onChange={(e) => handleStatusChange(app.id, e.target.value)}
                          className={`px-3 py-1 rounded-full text-xs font-semibold bg-${getStatusColor(app.status)}/20 text-${getStatusColor(app.status)} 
                                    border-2 border-transparent focus:border-cyber-green focus:outline-none cursor-pointer`}
                        >
                          {statuses.map(status => (
                            <option key={status} value={status}>
                              {getStatusLabel(status)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => setSelectedApplication(app)}
                            className="btn-secondary py-2 px-4 text-sm flex items-center space-x-2"
                          >
                            <FaEye />
                            <span>View</span>
                          </button>
                          <button
                            onClick={() => handleDeleteApplication(app.id)}
                            className="bg-cyber-red/20 hover:bg-cyber-red/30 text-cyber-red py-2 px-4 rounded-lg text-sm flex items-center space-x-2 transition-colors"
                            title="Delete application"
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
          </div>
        </>
      )}

      {/* Application Detail Modal */}
      {selectedApplication && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-dark-card border-2 border-cyber-green rounded-xl p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="heading-lg text-gradient mb-2">
                  {selectedApplication.firstName} {selectedApplication.lastName}
                </h2>
                <p className="text-cyber-cyan font-semibold">{selectedApplication.jobTitle}</p>
              </div>
              <button
                onClick={() => setSelectedApplication(null)}
                className="text-text-secondary hover:text-cyber-red text-2xl"
              >
                <FaTimes />
              </button>
            </div>

            <div className="space-y-6">
              {/* Contact Information */}
              <div className="card-dark p-6">
                <h3 className="text-lg font-bold text-text-primary mb-4">Contact Information</h3>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <FaEnvelope className="text-cyber-cyan" />
                    <a href={`mailto:${selectedApplication.email}`} className="text-text-secondary hover:text-cyber-cyan">
                      {selectedApplication.email}
                    </a>
                  </div>
                  <div className="flex items-center space-x-3">
                    <FaPhone className="text-cyber-green" />
                    <span className="text-text-secondary font-mono">{selectedApplication.phone}</span>
                  </div>
                  {selectedApplication.linkedin && (
                    <div className="flex items-center space-x-3">
                      <FaLinkedin className="text-cyber-blue" />
                      <a href={selectedApplication.linkedin} target="_blank" rel="noopener noreferrer" 
                         className="text-text-secondary hover:text-cyber-blue">
                        View LinkedIn Profile →
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Application Details */}
              <div className="card-dark p-6">
                <h3 className="text-lg font-bold text-text-primary mb-4">Application Details</h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-text-muted text-sm">Applied Date</p>
                    <p className="text-text-primary font-semibold">
                      {new Date(selectedApplication.appliedDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-text-muted text-sm">Current Status</p>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold bg-${getStatusColor(selectedApplication.status)}/20 text-${getStatusColor(selectedApplication.status)}`}>
                      {getStatusLabel(selectedApplication.status)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Cover Letter */}
              <div className="card-dark p-6">
                <h3 className="text-lg font-bold text-text-primary mb-4">Cover Letter / Message</h3>
                <p className="text-text-secondary leading-relaxed whitespace-pre-wrap">
                  {selectedApplication.coverLetter}
                </p>
              </div>

              {/* Actions */}
              <div className="flex space-x-4">
                <button
                  onClick={() => {
                    handleStatusChange(selectedApplication.id, 'interview');
                    setSelectedApplication(null);
                  }}
                  className="flex-1 btn-primary py-3 flex items-center justify-center space-x-2"
                >
                  <FaCheck />
                  <span>Move to Interview</span>
                </button>
                <button
                  onClick={() => {
                    handleStatusChange(selectedApplication.id, 'rejected');
                    setSelectedApplication(null);
                  }}
                  className="flex-1 bg-cyber-red/20 text-cyber-red hover:bg-cyber-red/30 py-3 rounded-lg font-semibold 
                           flex items-center justify-center space-x-2 transition-colors"
                >
                  <FaTimes />
                  <span>Reject</span>
                </button>
                <button
                  onClick={() => {
                    handleDeleteApplication(selectedApplication.id);
                  }}
                  className="flex-1 bg-dark-lighter text-cyber-red hover:bg-cyber-red/20 hover:text-cyber-red py-3 rounded-lg font-semibold 
                           flex items-center justify-center space-x-2 transition-colors border-2 border-transparent hover:border-cyber-red"
                >
                  <FaTrash />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AdminShell>
  );
}
