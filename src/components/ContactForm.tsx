'use client';

import { useState, FormEvent, useEffect } from 'react';
import { FaCheckCircle, FaExclamationTriangle, FaPaperPlane } from 'react-icons/fa';
import CloudflareTurnstile from './CloudflareTurnstile';

export default function ContactForm() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    message: '',
  });
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus('submitting');
    setErrorMessage(null);

    if (!turnstileToken) {
      setErrorMessage('Please complete the security verification');
      setStatus('error');
      setTimeout(() => setStatus('idle'), 5000);
      return;
    }

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, turnstileToken }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const msg = (data && data.error) || `Request failed: ${res.status}`;
        setErrorMessage(msg);
        setStatus('error');
        setTimeout(() => setStatus('idle'), 5000);
        return;
      }

      setStatus('success');
      setFormData({ name: '', email: '', company: '', message: '' });
      setTurnstileToken(null);
      setTimeout(() => setStatus('idle'), 5000);
    } catch (error) {
      console.error('Contact form submit failed', error);
      setErrorMessage('Unable to send message. Please try again.');
      setStatus('error');
      setTimeout(() => setStatus('idle'), 5000);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 relative">
      <div className={mounted ? 'animate-fade-in-up animate-delay-100' : 'opacity-0'}>
        <label htmlFor="name" className="block text-sm font-bold uppercase text-text-primary mb-2">
          Name <span aria-hidden="true">*</span><span className="sr-only"> required</span>
        </label>
        <div className="relative">
          <input
            type="text"
            id="name"
            name="name"
            required
            value={formData.name}
            onChange={handleChange}
            onFocus={() => setFocusedField('name')}
            onBlur={() => setFocusedField(null)}
            className="w-full px-4 py-3 bg-dark-lighter border border-dark-card/50 rounded-lg text-text-primary placeholder-text-muted transition-smooth
            focus:outline-none focus:border-cyber-blue focus:shadow-glow"
            placeholder="John Doe"
          />
          {focusedField === 'name' && (
            <div className="focus-indicator active border-cyber-blue" />
          )}
        </div>
      </div>

      <div className={mounted ? 'animate-fade-in-up animate-delay-200' : 'opacity-0'}>
        <label htmlFor="email" className="block text-sm font-bold uppercase text-text-primary mb-2">
          Email <span aria-hidden="true">*</span><span className="sr-only"> required</span>
        </label>
        <div className="relative">
          <input
            type="email"
            id="email"
            name="email"
            required
            value={formData.email}
            onChange={handleChange}
            onFocus={() => setFocusedField('email')}
            onBlur={() => setFocusedField(null)}
            className="w-full px-4 py-3 bg-dark-lighter border border-dark-card/50 rounded-lg text-text-primary placeholder-text-muted transition-smooth
            focus:outline-none focus:border-cyber-cyan focus:shadow-glow"
            placeholder="john@company.com"
          />
          {focusedField === 'email' && (
            <div className="focus-indicator active border-cyber-cyan" />
          )}
        </div>
      </div>

      <div className={mounted ? 'animate-fade-in-up animate-delay-300' : 'opacity-0'}>
        <label htmlFor="company" className="block text-sm font-bold uppercase text-text-primary mb-2">
          Company
        </label>
        <div className="relative">
          <input
            type="text"
            id="company"
            name="company"
            value={formData.company}
            onChange={handleChange}
            onFocus={() => setFocusedField('company')}
            onBlur={() => setFocusedField(null)}
            className="w-full px-4 py-3 bg-dark-lighter border border-dark-card/50 rounded-lg text-text-primary placeholder-text-muted transition-smooth
            focus:outline-none focus:border-cyber-purple focus:shadow-glow"
            placeholder="Your Company Inc. (optional)"
          />
          {focusedField === 'company' && (
            <div className="focus-indicator active border-cyber-purple" />
          )}
        </div>
      </div>

      <div className={mounted ? 'animate-fade-in-up animate-delay-400' : 'opacity-0'}>
        <label htmlFor="message" className="block text-sm font-bold uppercase text-text-primary mb-2">
          Message <span aria-hidden="true">*</span><span className="sr-only"> required</span>
        </label>
        <div className="relative">
          <textarea
            id="message"
            name="message"
            required
            rows={6}
            value={formData.message}
            onChange={handleChange}
            onFocus={() => setFocusedField('message')}
            onBlur={() => setFocusedField(null)}
            className="w-full px-4 py-3 bg-dark-lighter border border-dark-card/50 rounded-lg text-text-primary placeholder-text-muted transition-smooth resize-none
            focus:outline-none focus:border-cyber-green focus:shadow-glow"
            placeholder="Tell us about your project or inquiry..."
          />
          {focusedField === 'message' && (
            <div className="focus-indicator active border-cyber-green" />
          )}
        </div>
      </div>

      {status === 'success' && (
        <div className="bg-cyber-green/10 border border-cyber-green/50 text-cyber-green px-4 py-3 rounded-lg flex items-center space-x-3 animate-fade-in">
          <FaCheckCircle className="text-2xl flex-shrink-0" />
          <div>
            <p className="font-bold">Success!</p>
            <p className="text-sm">Your message has been sent. We'll get back to you soon.</p>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="bg-cyber-red/10 border border-cyber-red/50 text-cyber-red px-4 py-3 rounded-lg flex items-center space-x-3 animate-fade-in">
          <FaExclamationTriangle className="text-2xl flex-shrink-0" />
          <div>
            <p className="font-bold">Error</p>
            <p className="text-sm">{errorMessage || 'Something went wrong. Please try again or contact us directly.'}</p>
          </div>
        </div>
      )}

      {/* Cloudflare Turnstile */}
      <div className={mounted ? 'flex justify-center animate-fade-in-up animate-delay-400' : 'opacity-0 flex justify-center'}>
        <CloudflareTurnstile
          onVerify={(token) => setTurnstileToken(token)}
          onError={() => {
            setTurnstileToken(null);
            setErrorMessage('Security verification failed. Please try again.');
          }}
          theme="dark"
        />
      </div>

      <button
        type="submit"
        disabled={status === 'submitting' || !turnstileToken}
        className="w-full btn-cta text-center disabled:opacity-50 disabled:cursor-not-allowed 
                 flex items-center justify-center space-x-2 relative overflow-hidden group
                 hover:scale-[1.02] active:scale-[0.98] transition-transform"
      >
        {status === 'submitting' ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>Sending...</span>
          </>
        ) : (
          <>
            <FaPaperPlane className="group-hover:translate-x-1 transition-transform" />
            <span>Send Message</span>
          </>
        )}
      </button>

      <p className={mounted ? 'text-xs text-text-muted text-center animate-fade-in animate-delay-400' : 'text-xs text-text-muted text-center opacity-0'}>
        By submitting this form, you agree to our{' '}
        <a href="/privacy" className="text-cyber-blue hover:text-cyber-cyan transition-colors">
          privacy policy
        </a>
        .
      </p>
    </form>
  );
}
