'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FaCheckCircle } from 'react-icons/fa';
import { AnimatedStatsGrid } from '@/components/AnimatedStats';

const DEFAULT_VALUES = ['Professionalism', 'Reliability', 'Accountability', 'Innovation'];

const DEFAULT_ABOUT = {
  badge: '> We Just Do IT',
  headingLead: 'Your Trusted IT Partner',
  headingHighlight: 'Since 1994',
  paragraphs: [
    'For over three decades, RHC Solutions has been at the forefront of IT innovation, helping businesses transform their operations through strategic technology implementation.',
    'Our mission is to enhance your organization’s performance by delivering robust, scalable IT infrastructure solutions that drive efficiency and growth. We combine deep technical expertise with a passion for solving complex business challenges.',
  ],
  valuesHeadingLead: 'Our Core',
  valuesHeadingHighlight: 'Values',
  ctaLabel: 'Learn More About Us',
  ctaHref: '/about-us',
};

// Numeric-only stats (the AnimatedStatsGrid counts up from 0); pulled from
// CMS settings.stats with sensible fallbacks if the API is unavailable.
const DEFAULT_STATS = [
  { value: 1994, label: 'Founded', prefix: '' },
  { value: 500, label: 'Projects Delivered', suffix: '+' },
  { value: 15, label: 'Industries Served', suffix: '+' },
  { value: 98, label: 'Client Satisfaction', suffix: '%' },
];

const parseNum = (s: string | number | undefined, fallback: number): number => {
  if (typeof s === 'number') return s;
  if (!s) return fallback;
  const m = s.match(/\d+/);
  return m ? Number(m[0]) : fallback;
};

export default function AboutPreview() {
  const [stats, setStats] = useState(DEFAULT_STATS);
  const [values, setValues] = useState<string[]>(DEFAULT_VALUES);
  const [about, setAbout] = useState(DEFAULT_ABOUT);
  const [yearsHeadline, setYearsHeadline] = useState({
    number: '30+',
    label: 'Years of Excellence',
    subtitle: 'Leading the industry since 1994',
  });

  useEffect(() => {
    fetch('/api/cms/settings').then((r) => r.ok ? r.json() : null).then((s) => {
      if (!s) return;
      const cmsStats = s.stats;
      const brand = s.brand || {};
      const foundingYear = brand.foundingYear || 1994;
      if (cmsStats) {
        setStats([
          { value: foundingYear, label: 'Founded', prefix: '' },
          { value: parseNum(cmsStats.projects, 500), label: cmsStats.projectsLabel || 'Projects Delivered', suffix: '+' },
          { value: parseNum(cmsStats.industries, 15), label: cmsStats.industriesLabel || 'Industries Served', suffix: '+' },
          { value: parseNum(cmsStats.satisfaction, 98), label: cmsStats.satisfactionLabel || 'Client Satisfaction', suffix: '%' },
        ]);
      }
      if (Array.isArray(brand.values) && brand.values.length) setValues(brand.values);
      if (brand.about) setAbout({ ...DEFAULT_ABOUT, ...brand.about });
      if (brand.yearsHeadlineNumber || brand.yearsHeadlineLabel || brand.yearsHeadlineSubtitle) {
        setYearsHeadline({
          number: brand.yearsHeadlineNumber || '30+',
          label: brand.yearsHeadlineLabel || 'Years of Excellence',
          subtitle: brand.yearsHeadlineSubtitle || `Leading the industry since ${foundingYear}`,
        });
      }
    }).catch(() => undefined);
  }, []);

  return (
    <section className="section-padding bg-dark-lighter relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-cyber-grid opacity-5" />
      <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-cyber-purple/10 rounded-full blur-3xl" />
      
      <div className="container-custom relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left Column - Content */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-block bg-cyber-green/10 text-cyber-green font-bold px-6 py-2 rounded-full mb-6 border border-cyber-green/30">
              <span className="text-mono">{about.badge}</span>
            </div>

            <h2 className="heading-lg mb-6">
              {about.headingLead} <span className="text-gradient">{about.headingHighlight}</span>
            </h2>

            <div className="space-y-6 text-text-secondary text-lg">
              {about.paragraphs.map((para, idx) => (
                <p key={idx}>{para}</p>
              ))}

              <div className="mt-8">
                <h3 className="heading-sm mb-6">{about.valuesHeadingLead} <span className="text-gradient">{about.valuesHeadingHighlight}</span></h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {values.map((value, index) => (
                    <motion.div
                      key={value}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.1, duration: 0.5 }}
                      className="flex items-center space-x-3 bg-dark-card border border-dark-border rounded-lg p-3 
                               hover:border-cyber-blue transition-all duration-300 group"
                    >
                      <FaCheckCircle className="text-cyber-green text-xl flex-shrink-0 group-hover:scale-110 transition-transform" />
                      <span className="font-medium text-text-primary">{value}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="mt-8"
            >
              <Link href={about.ctaHref} className="btn-primary">
                <span>{about.ctaLabel}</span>
              </Link>
            </motion.div>
          </motion.div>

          {/* Right Column - Stats */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative"
          >
            <div className="card-cyber p-8">
              <div className="text-center mb-8">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  whileInView={{ scale: 1, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
                  className="text-7xl font-bold text-gradient mb-4"
                >
                  {yearsHeadline.number}
                </motion.div>
                <div className="text-2xl font-semibold text-text-primary mb-2">{yearsHeadline.label}</div>
                <p className="text-text-muted text-sm">{yearsHeadline.subtitle}</p>
              </div>
              
              <div className="divider-glow" />
              
              <div className="mt-8">
                <AnimatedStatsGrid stats={stats} columns={2} />
              </div>
            </div>

            {/* Decorative Glow Elements */}
            <div className="absolute -top-6 -right-6 w-24 h-24 bg-cyber-blue/20 rounded-full blur-2xl" />
            <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-cyber-purple/20 rounded-full blur-2xl" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
