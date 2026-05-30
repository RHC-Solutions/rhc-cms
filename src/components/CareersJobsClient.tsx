'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { Job } from './CareersJobs';
import { FaArrowRight, FaBriefcase, FaMapMarkerAlt, FaPaperclip, FaSpinner, FaUpload, FaLinkedin, FaFacebook, FaInstagram, FaShareAlt, FaLink, FaCheck } from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';
import CloudflareTurnstile from './CloudflareTurnstile';

// List of disposable/temporary/fake email domains to block
const DISPOSABLE_EMAIL_DOMAINS = [
  // Disposable email services
  'tempmail.com', 'throwaway.email', 'guerrillamail.com', 'mailinator.com',
  'temp-mail.org', '10minutemail.com', 'fakeinbox.com', 'trashmail.com',
  'getnada.com', 'mohmal.com', 'tempail.com', 'dispostable.com',
  'mailnesia.com', 'tempr.email', 'discard.email', 'maildrop.cc',
  'yopmail.com', 'sharklasers.com', 'spam4.me', 'grr.la',
  'guerrillamailblock.com', 'pokemail.net', 'spamgourmet.com', 'mytrashmail.com',
  'mailcatch.com', 'mailexpire.com', 'tempinbox.com', 'fakemailgenerator.com',
  'emailondeck.com', 'throwawaymail.com', 'mintemail.com', 'tempmailaddress.com',
  // Common test/fake domains
  'test.com', 'example.com', 'example.org', 'example.net', 'fake.com',
  'asdf.com', 'asdfasdf.com', 'asd.com', 'qwerty.com', 'abc.com',
  'xyz.com', 'testing.com', 'fakemail.com', 'noemail.com', 'none.com',
  'invalid.com', 'null.com', 'void.com', 'spam.com', 'junk.com'
];

interface Props {
  jobs: Job[];
}

export default function CareersJobsClient({ jobs }: Props) {
  const visibleJobs = useMemo(() => jobs.filter((j) => j.visible), [jobs]);

  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [resume, setResume] = useState<File | null>(null);
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [filterLocation, setFilterLocation] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [turnstileToken, setTurnstileToken] = useState<string>('');
  const [copiedJobId, setCopiedJobId] = useState<string | null>(null);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '+',
    linkedin: 'https://www.linkedin.com/in/',
    coverLetter: '',
  });

  const departments = useMemo(() => ['all', ...Array.from(new Set(visibleJobs.map((j) => j.department)))], [visibleJobs]);
  const locations = useMemo(() => {
    const locs = new Set<string>();
    visibleJobs.forEach((j) => {
      if (j.locationType === 'remote') locs.add('remote');
      else if (j.country) locs.add(j.country);
    });
    return ['all', ...Array.from(locs)];
  }, [visibleJobs]);
  const types = useMemo(() => ['all', ...Array.from(new Set(visibleJobs.map((j) => j.type)))], [visibleJobs]);

  const filteredJobs = useMemo(() => {
    return visibleJobs.filter((job) => {
      if (filterDepartment !== 'all' && job.department !== filterDepartment) return false;
      if (filterType !== 'all' && job.type !== filterType) return false;
      if (filterLocation !== 'all') {
        if (filterLocation === 'remote' && job.locationType !== 'remote') return false;
        if (filterLocation !== 'remote' && job.country !== filterLocation) return false;
      }
      return true;
    });
  }, [visibleJobs, filterDepartment, filterLocation, filterType]);

  const selectedJob = filteredJobs.find((job) => job.id === selectedJobId) || null;
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Detect country code via GeoIP on mount
  useEffect(() => {
    const detectCountryCode = async () => {
      try {
        const res = await fetch('https://ipapi.co/json/');
        const data = await res.json();
        const countryCode = data.country_calling_code || '+1';
        setForm((prev) => ({ ...prev, phone: countryCode }));
      } catch {
        // Fallback to +1 if GeoIP fails
        setForm((prev) => ({ ...prev, phone: '+1' }));
      }
    };
    detectCountryCode();

    // Check if URL contains a job ID hash and expand it
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#job-', '');
      if (hash && visibleJobs.find(j => j.id === hash)) {
        setExpandedJobId(hash);
        setTimeout(() => {
          document.getElementById(`job-${hash}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
    }
  }, [visibleJobs]);

  const handleApply = (jobId: string) => {
    setSelectedJobId(jobId);
    setMessage('');
    setResume(null);
    setTimeout(() => {
      document.getElementById('application-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const toggleExpand = (jobId: string) => {
    const newExpandedId = expandedJobId === jobId ? null : jobId;
    setExpandedJobId(newExpandedId);
    
    // Update URL hash
    if (typeof window !== 'undefined') {
      if (newExpandedId) {
        window.history.replaceState(null, '', `#job-${jobId}`);
      } else {
        window.history.replaceState(null, '', window.location.pathname);
      }
    }
  };

  const getJobUrl = (jobId: string): string => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/careers#job-${jobId}`;
    }
    return `https://rhcsolutions.com/careers#job-${jobId}`;
  };

  const copyJobLink = async (jobId: string, jobTitle: string) => {
    const url = getJobUrl(jobId);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedJobId(jobId);
      setTimeout(() => setCopiedJobId(null), 2000);
    } catch (err) {
      console.error('Failed to copy link', err);
    }
  };

  const isDisposableEmail = (email: string): boolean => {
    const domain = email.split('@')[1]?.toLowerCase();
    return DISPOSABLE_EMAIL_DOMAINS.includes(domain);
  };

  const isValidPhoneNumber = (phone: string): { valid: boolean; message: string } => {
    const cleanPhone = phone.replace(/[\s\-\(\)\.]/g, '');
    
    // Must start with + and country code
    if (!cleanPhone.startsWith('+')) {
      return { valid: false, message: 'Phone must start with + and country code.' };
    }
    
    // Check length (minimum 10 digits total for real phone numbers, max 15 per E.164)
    const digitsOnly = cleanPhone.replace(/\D/g, '');
    if (digitsOnly.length < 10) {
      return { valid: false, message: 'Phone number is too short. Please include country code and full number.' };
    }
    if (digitsOnly.length > 15) {
      return { valid: false, message: 'Phone number is too long.' };
    }
    
    // Check for obviously fake patterns (all same digits)
    const repeatedPattern = /^(\d)\1{5,}$/;
    if (repeatedPattern.test(digitsOnly.slice(1))) {
      return { valid: false, message: 'Please enter a valid phone number.' };
    }
    
    // Check for repetitive patterns like 123123, 12341234, etc.
    const numberPart = digitsOnly.slice(1); // Remove country code first digit
    for (let patternLen = 2; patternLen <= 4; patternLen++) {
      if (numberPart.length >= patternLen * 2) {
        const pattern = numberPart.slice(0, patternLen);
        const repeated = pattern.repeat(Math.ceil(numberPart.length / patternLen));
        if (repeated.startsWith(numberPart)) {
          return { valid: false, message: 'Please enter a valid phone number.' };
        }
      }
    }
    
    // Check for sequential numbers like 1234567890
    const sequential = '12345678901234567890';
    const reverseSequential = '09876543210987654321';
    if (sequential.includes(numberPart) || reverseSequential.includes(numberPart)) {
      if (numberPart.length >= 6) {
        return { valid: false, message: 'Please enter a valid phone number.' };
      }
    }
    
    // Basic E.164 format validation
    const phoneRegex = /^\+[1-9]\d{8,14}$/;
    if (!phoneRegex.test(cleanPhone)) {
      return { valid: false, message: 'Phone must be in international format, e.g. +1234567890.' };
    }
    
    return { valid: true, message: '' };
  };

  const validate = () => {
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) return 'Please enter a valid email.';
    
    // Check for disposable email
    if (isDisposableEmail(form.email)) {
      return 'Please use a valid personal or work email address. Temporary emails are not accepted.';
    }

    // Phone validation
    const phoneValidation = isValidPhoneNumber(form.phone);
    if (!phoneValidation.valid) return phoneValidation.message;

    // LinkedIn validation
    if (!form.linkedin.includes('linkedin.com/in/') || form.linkedin.trim() === 'https://www.linkedin.com/in/') {
      return 'Please enter your full LinkedIn profile URL.';
    }

    if (!selectedJob) return 'Please select a position to apply for.';
    
    // Turnstile validation
    if (!turnstileToken) return 'Please complete the security verification.';
    
    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');

    const validation = validate();
    if (validation) {
      setMessage(`✗ ${validation}`);
      return;
    }

    setSubmitting(true);
    try {
      const cleanPhone = form.phone.replace(/[\s\-\(\)]/g, '');
      const fd = new FormData();
      fd.append('firstName', form.firstName);
      fd.append('lastName', form.lastName);
      fd.append('email', form.email);
      fd.append('phone', cleanPhone);
      fd.append('linkedin', form.linkedin.trim());
      fd.append('coverLetter', form.coverLetter);
      fd.append('jobTitle', selectedJob?.title || 'Unknown Position');
      fd.append('turnstileToken', turnstileToken);
      if (resume) fd.append('resume', resume);

      const res = await fetch('/api/apply', { method: 'POST', body: fd });
      const data = await res.json();
      if (res.ok) {
        setMessage('✓ Application submitted successfully. We will review and respond shortly.');
        setForm({ firstName: '', lastName: '', email: '', phone: '+', linkedin: 'https://www.linkedin.com/in/', coverLetter: '' });
        setResume(null);
        setSelectedJobId(null);
      } else {
        setMessage(`✗ ${data.error || 'Failed to submit application.'}`);
      }
    } catch (err) {
      console.error('Apply error', err);
      setMessage('✗ Error submitting application. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!visibleJobs.length) {
    return (
      <section className="container-custom py-12">
        <div className="card-cyber p-8 text-text-secondary">No open positions at the moment.</div>
      </section>
    );
  }

  return (
    <section className="container-custom py-12 space-y-10" id="careers-openings">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
        <div>
          <h2 className="heading-lg">Open Positions</h2>
          <p className="text-text-secondary">Filter and apply to roles that match your expertise</p>
        </div>
        <div className="text-text-muted text-sm">{filteredJobs.length} position{filteredJobs.length !== 1 ? 's' : ''}</div>
      </div>

      {/* Filters */}
      <div className="card-cyber p-4 flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <label className="text-text-secondary text-sm font-semibold">Department:</label>
          <select
            value={filterDepartment}
            onChange={(e) => setFilterDepartment(e.target.value)}
            className="bg-dark border border-dark-border rounded px-3 py-1.5 text-text-primary text-sm focus:outline-none focus:border-cyber-cyan"
          >
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept === 'all' ? 'All Departments' : dept}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-text-secondary text-sm font-semibold">Location:</label>
          <select
            value={filterLocation}
            onChange={(e) => setFilterLocation(e.target.value)}
            className="bg-dark border border-dark-border rounded px-3 py-1.5 text-text-primary text-sm focus:outline-none focus:border-cyber-cyan"
          >
            {locations.map((loc) => (
              <option key={loc} value={loc}>
                {loc === 'all' ? 'All Locations' : loc === 'remote' ? 'Remote' : loc}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-text-secondary text-sm font-semibold">Type:</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-dark border border-dark-border rounded px-3 py-1.5 text-text-primary text-sm focus:outline-none focus:border-cyber-cyan"
          >
            {types.map((type) => (
              <option key={type} value={type}>
                {type === 'all' ? 'All Types' : type}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Jobs List */}
      <div className="space-y-3" id="careers-openings-list">
        {filteredJobs.length === 0 ? (
          <div className="card-cyber p-8 text-center text-text-secondary">No positions match the selected filters.</div>
        ) : (
          filteredJobs.map((job) => {
            const isExpanded = expandedJobId === job.id;
            const jobUrl = getJobUrl(job.id);
            return (
              <div
                key={job.id}
                id={`job-${job.id}`}
                className={`card-cyber transition-all ${isExpanded ? 'border-cyber-cyan' : 'hover:border-cyber-cyan/50'}`}
              >
                <div
                  className="p-5 cursor-pointer"
                  onClick={() => toggleExpand(job.id)}
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-lg font-semibold text-text-primary">{job.title}</h3>
                        <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-dark border border-dark-border text-text-secondary">
                          <FaBriefcase className="text-[10px]" />
                          {job.department}
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-dark border border-dark-border text-text-secondary">
                          <FaMapMarkerAlt className="text-[10px]" />
                          {job.locationType === 'remote' ? 'Remote' : `${job.city || ''}${job.city && job.country ? ', ' : ''}${job.country || ''}`}
                        </span>
                        <span className="text-xs text-text-muted">{job.type}</span>
                      </div>
                      {!isExpanded && (
                        <p className="text-text-secondary text-sm line-clamp-2 mt-2">{job.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyJobLink(job.id, job.title);
                        }}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded text-sm transition-colors ${
                          copiedJobId === job.id 
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                            : 'bg-dark-border hover:bg-cyber-cyan/20 text-text-primary hover:text-cyber-cyan border border-dark-border'
                        }`}
                        title="Copy direct link to this position"
                      >
                        {copiedJobId === job.id ? <><FaCheck /> Copied!</> : <><FaLink /> Share</>}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleApply(job.id);
                        }}
                        className="btn-primary inline-flex items-center gap-2 px-4 py-2 whitespace-nowrap"
                      >
                        Apply <FaArrowRight />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-dark-border px-5 pb-5 pt-4 space-y-4 bg-dark/30">
                    <div>
                      <h4 className="text-md font-semibold text-text-primary mb-2">Full Description</h4>
                      <div className="text-text-secondary text-sm whitespace-pre-wrap">{job.description}</div>
                    </div>
                    {job.requirements && (
                      <div>
                        <h4 className="text-md font-semibold text-text-primary mb-2">Requirements</h4>
                        <div className="text-text-secondary text-sm whitespace-pre-wrap">{job.requirements}</div>
                      </div>
                    )}
                    <div className="flex flex-col gap-4 pt-2">
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApply(job.id);
                          }}
                          className="btn-primary inline-flex items-center gap-2 px-6 py-2"
                        >
                          Apply for this Position <FaArrowRight />
                        </button>
                        <button
                          type="button"
                          onClick={() => setExpandedJobId(null)}
                          className="btn-secondary inline-flex items-center gap-2 px-6 py-2"
                        >
                          Close
                        </button>
                      </div>
                      <div className="flex items-center gap-3 pt-4 border-t border-dark-border">
                        <span className="text-text-secondary text-sm font-medium flex items-center gap-1.5">
                          <FaShareAlt className="text-sm" /> Share:
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyJobLink(job.id, job.title);
                          }}
                          className={`inline-flex items-center justify-center w-10 h-10 rounded-lg text-lg transition-all ${
                            copiedJobId === job.id 
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg' 
                              : 'bg-dark-border hover:bg-cyber-cyan/30 text-text-primary hover:text-cyber-cyan border border-dark-border hover:border-cyber-cyan'
                          }`}
                          title="Copy direct link to this position"
                        >
                          {copiedJobId === job.id ? <FaCheck /> : <FaLink />}
                        </button>
                        <a
                          href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(jobUrl)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center justify-center w-10 h-10 bg-[#0077b5] hover:bg-[#006399] text-white rounded-lg text-lg transition-all hover:shadow-lg"
                          title="Share on LinkedIn"
                        >
                          <FaLinkedin />
                        </a>
                        <a
                          href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(jobUrl)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center justify-center w-10 h-10 bg-[#1877f2] hover:bg-[#166fe5] text-white rounded-lg text-lg transition-all hover:shadow-lg"
                          title="Share on Facebook"
                        >
                          <FaFacebook />
                        </a>
                        <a
                          href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(jobUrl)}&text=${encodeURIComponent(`Check out this position: ${job.title} at RHC Solutions`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center justify-center w-10 h-10 bg-black hover:bg-gray-800 text-white rounded-lg text-lg transition-all hover:shadow-lg"
                          title="Share on X (Twitter)"
                        >
                          <FaXTwitter />
                        </a>
                        <a
                          href={`https://www.instagram.com/`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center justify-center w-10 h-10 bg-gradient-to-r from-[#833ab4] via-[#fd1d1d] to-[#fcb045] hover:opacity-90 text-white rounded-lg text-lg transition-all hover:shadow-lg"
                          title="Share on Instagram"
                        >
                          <FaInstagram />
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div id="application-form" className="card-cyber p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h3 className="heading-md text-gradient">Apply for Position</h3>
            <p className="text-text-secondary">Complete the form to send your application via our secure channel.</p>
          </div>
          {selectedJob && (
            <div className="text-text-primary font-semibold">Selected: {selectedJob.title}</div>
          )}
        </div>

        {!selectedJob && (
          <div className="bg-dark border border-dark-border rounded-lg p-4 text-text-secondary mb-6">
            Choose a role above to populate the application form.
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-2">First Name</label>
            <input
              type="text"
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              className="w-full bg-dark border border-dark-border rounded-lg px-4 py-3 text-text-primary focus:outline-none focus:border-cyber-cyan"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-2">Last Name</label>
            <input
              type="text"
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              className="w-full bg-dark border border-dark-border rounded-lg px-4 py-3 text-text-primary focus:outline-none focus:border-cyber-cyan"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-2">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full bg-dark border border-dark-border rounded-lg px-4 py-3 text-text-primary focus:outline-none focus:border-cyber-cyan"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-2">Phone (international)</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full bg-dark border border-dark-border rounded-lg px-4 py-3 text-text-primary focus:outline-none focus:border-cyber-cyan"
              required
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-text-primary mb-2">LinkedIn URL</label>
            <input
              type="url"
              value={form.linkedin}
              onChange={(e) => setForm({ ...form, linkedin: e.target.value })}
              className="w-full bg-dark border border-dark-border rounded-lg px-4 py-3 text-text-primary focus:outline-none focus:border-cyber-cyan"
              required
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-text-primary mb-2">Cover Letter / Notes</label>
            <textarea
              value={form.coverLetter}
              onChange={(e) => setForm({ ...form, coverLetter: e.target.value })}
              className="w-full bg-dark border border-dark-border rounded-lg px-4 py-3 text-text-primary focus:outline-none focus:border-cyber-cyan h-28"
              placeholder="Share relevant experience and motivations"
            />
          </div>
          <div>
            <label className="flex text-sm font-semibold text-text-primary mb-2 items-center gap-2"><FaPaperclip /> Resume (optional, PDF/DOC)</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={(e) => setResume(e.target.files?.[0] || null)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full bg-dark border border-dark-border hover:border-cyber-cyan rounded-lg px-4 py-3 text-text-secondary hover:text-text-primary flex items-center gap-2 transition-colors"
            >
              <FaUpload />
              {resume ? resume.name : 'Choose file (PDF, DOC, DOCX)'}
            </button>
          </div>
          <div className="md:col-span-2 flex flex-col gap-3">
            {/* Cloudflare Turnstile */}
            <div className="flex justify-center">
              <CloudflareTurnstile
                onVerify={(token) => setTurnstileToken(token)}
                onError={() => setTurnstileToken('')}
              />
            </div>
            {message && (
              <div className={`rounded-lg px-4 py-3 ${message.startsWith('✓') ? 'bg-emerald-900/60 border border-emerald-700 text-emerald-100' : 'bg-red-900/60 border border-red-700 text-red-100'}`}>
                {message}
              </div>
            )}
            <button
              type="submit"
              disabled={submitting || !selectedJob || !turnstileToken}
              className="btn-primary inline-flex items-center gap-2 justify-center px-6 py-3 disabled:opacity-60"
            >
              {submitting ? <><FaSpinner className="animate-spin" /> Sending...</> : 'Submit Application'}
            </button>
            <p className="text-text-muted text-xs">Applications are delivered to our hiring channel via secure webhook.</p>
          </div>
        </form>
      </div>
    </section>
  );
}
