'use client';

import { motion } from 'framer-motion';
import { FaCheckCircle, FaRocket } from 'react-icons/fa';
import Link from 'next/link';
import { useEffect, useState } from 'react';

const DEFAULT_BADGES = [
  '30+ Years of Excellence',
  '500+ Projects Delivered',
  '98% Client Satisfaction',
];

const DEFAULT_HEADING = {
  headingLead: 'Ready to Transform Your',
  headingHighlight: 'IT Infrastructure',
  headingTrailing: '?',
  description: 'Let’s discuss how Your Site Name can help drive your business forward with innovative IT solutions tailored to your unique needs.',
};

export default function CTASection() {
  const [bookingUrl, setBookingUrl] = useState<string>('');
  const [badges, setBadges] = useState<string[]>(DEFAULT_BADGES);
  const [ctaPrimary, setCtaPrimary] = useState<string>('Book a 30-min call');
  const [ctaSecondary, setCtaSecondary] = useState<string>('Get in touch');
  const [heading, setHeading] = useState(DEFAULT_HEADING);

  useEffect(() => {
    fetch('/api/cms/settings').then((r) => r.ok ? r.json() : null).then((s) => {
      if (!s) return;
      if (s.bookingUrl) setBookingUrl(s.bookingUrl);
      if (s.cta?.primary?.label) setCtaPrimary(s.cta.primary.label);
      if (s.cta?.secondary?.label) setCtaSecondary(s.cta.secondary.label);
      if (s.brand?.ctaSection) setHeading({ ...DEFAULT_HEADING, ...s.brand.ctaSection });
      if (s.brand?.yearsBadge && s.stats) {
        setBadges([
          s.brand.yearsBadge,
          `${s.stats.projects} ${s.stats.projectsLabel}`,
          `${s.stats.satisfaction} ${s.stats.satisfactionLabel}`,
        ]);
      }
    }).catch(() => undefined);
  }, []);

  return (
    <section className="section-padding bg-gradient-cyber relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-cyber-grid opacity-10" />
      <div className="absolute inset-0 bg-noise opacity-20" />
      
      {/* Animated Orbs */}
      <motion.div
        className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyber-cyan/20 rounded-full blur-3xl"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <motion.div
        className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyber-green/20 rounded-full blur-3xl"
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.2, 0.4, 0.2],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      
      <div className="container-custom relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            {/* Icon */}
            <motion.div
              initial={{ scale: 0 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="inline-block mb-6"
            >
              <div className="w-16 h-16 bg-cyber-blue/10 border-2 border-cyber-blue rounded-full 
                            flex items-center justify-center mx-auto animate-pulse-slow">
                <FaRocket className="text-3xl text-cyber-blue" />
              </div>
            </motion.div>

            <h2 className="heading-lg mb-6">
              {heading.headingLead} <span className="text-gradient">{heading.headingHighlight}</span>{heading.headingTrailing}
            </h2>

            <p className="text-xl md:text-2xl mb-10 text-text-secondary max-w-3xl mx-auto">
              {heading.description}
            </p>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12"
            >
              {bookingUrl && (
                <a
                  href={bookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${ctaPrimary} (opens external calendar)`}
                  className="btn-cta text-lg px-10 py-4"
                >
                  {ctaPrimary}
                </a>
              )}
              <Link
                href="/contact"
                className="btn-secondary text-lg px-10 py-4"
              >
                {ctaSecondary}
              </Link>
            </motion.div>

            {/* Trust Badges */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.6, duration: 0.6 }}
              className="flex flex-wrap justify-center gap-6 md:gap-8"
            >
              {badges.map((text, index) => (
                <motion.div
                  key={text}
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.7 + index * 0.1, duration: 0.5 }}
                  className="flex items-center space-x-2 bg-dark-card border border-cyber-blue/30
                           rounded-full px-6 py-3 hover:border-cyber-blue hover:shadow-[0_0_20px_rgba(0,217,255,0.3)]
                           transition-all duration-300"
                >
                  <FaCheckCircle className="text-cyber-green text-lg" aria-hidden="true" />
                  <span className="text-text-primary font-medium">{text}</span>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
