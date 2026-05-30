'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FaDice, FaGlobe, FaPlane, FaCheckCircle } from 'react-icons/fa';

const DEFAULT_TEASER = {
  headingLead: 'Client',
  headingHighlight: 'Success Stories',
  description: 'We’ve partnered with industry leaders across multiple sectors, delivering transformative IT solutions that drive business success.',
  ctaLabel: 'View All Case Studies',
  ctaHref: '/clients',
};

const caseStudies = [
  {
    icon: FaDice,
    industry: 'Gambling & Betting SaaS',
    title: 'Multi-Platform Gaming Infrastructure',
    description: 'Designed and implemented a scalable cloud infrastructure supporting millions of concurrent users across multiple gaming platforms.',
    highlights: [
      'Real-time data processing',
      'High-availability architecture',
      'Regulatory compliance (Gaming)',
    ],
    color: 'from-cyber-blue to-cyber-cyan',
  },
  {
    icon: FaGlobe,
    industry: 'Global Trading & Telecom',
    title: 'Enterprise Trading Platform',
    description: 'Built mission-critical trading infrastructure with sub-millisecond latency and 99.99% uptime for global financial operations.',
    highlights: [
      'Low-latency trading systems',
      'Global network optimization',
      'Disaster recovery solutions',
    ],
    color: 'from-cyber-cyan to-cyber-purple',
  },
  {
    icon: FaPlane,
    industry: 'Aerospace',
    title: 'Aviation Systems Integration',
    description: 'Delivered secure, compliant IT infrastructure for aerospace operations, ensuring seamless integration with legacy systems.',
    highlights: [
      'Security & compliance',
      'Legacy system modernization',
      'Mission-critical reliability',
    ],
    color: 'from-cyber-purple to-cyber-blue',
  },
];

export default function ClientsTeaser() {
  const [teaser, setTeaser] = useState(DEFAULT_TEASER);

  useEffect(() => {
    fetch('/api/cms/settings').then((r) => r.ok ? r.json() : null).then((s) => {
      if (s?.brand?.clientsTeaser) setTeaser({ ...DEFAULT_TEASER, ...s.brand.clientsTeaser });
    }).catch(() => undefined);
  }, []);

  return (
    <section className="section-padding bg-dark relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-cyber-grid opacity-5" />
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full h-full 
                    bg-gradient-to-br from-cyber-blue/5 via-transparent to-cyber-purple/5" />
      
      <div className="container-custom relative z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <h2 className="heading-lg mb-6">
            {teaser.headingLead} <span className="text-gradient">{teaser.headingHighlight}</span>
          </h2>
          <p className="text-xl text-text-secondary">
            {teaser.description}
          </p>
        </motion.div>

        {/* Case Studies Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          {caseStudies.map((study, index) => {
            const Icon = study.icon;
            return (
              <motion.div
                key={study.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.15, duration: 0.6 }}
                className="card-cyber group"
              >
                {/* Gradient Accent Bar */}
                <div className={`h-1 w-full bg-gradient-to-r ${study.color} rounded-t-xl mb-6`} />

                {/* Icon */}
                <motion.div
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                  className="text-5xl text-cyber-blue mb-4 inline-block"
                >
                  <Icon />
                </motion.div>

                {/* Industry Tag */}
                <div className="inline-block bg-cyber-blue/10 border border-cyber-blue/30 text-cyber-blue 
                              text-sm font-bold px-4 py-1 rounded-full mb-4">
                  {study.industry}
                </div>

                {/* Title */}
                <h3 className="heading-sm mb-3 group-hover:text-gradient transition-all duration-300">
                  {study.title}
                </h3>

                {/* Description */}
                <p className="text-text-secondary mb-6 leading-relaxed">
                  {study.description}
                </p>

                {/* Highlights */}
                <div className="space-y-3">
                  {study.highlights.map((highlight, idx) => (
                    <motion.div
                      key={highlight}
                      initial={{ opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.15 + idx * 0.1, duration: 0.5 }}
                      className="flex items-start space-x-3 group/item"
                    >
                      <FaCheckCircle className="text-cyber-green text-lg flex-shrink-0 mt-0.5 
                                              group-hover/item:scale-110 transition-transform" />
                      <span className="text-sm text-text-primary">{highlight}</span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="text-center"
        >
          <Link href={teaser.ctaHref} className="btn-primary text-lg">
            <span>{teaser.ctaLabel}</span>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
