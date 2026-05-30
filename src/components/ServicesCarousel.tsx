'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { FaCloud, FaShieldAlt, FaLaptopCode, FaServer, FaUsers, FaChevronLeft, FaChevronRight } from 'react-icons/fa';

interface Service {
  icon: React.ReactNode;
  title: string;
  description: string;
  features: string[];
  href: string;
  color: string;
}

const services: Service[] = [
  {
    icon: <FaLaptopCode className="text-5xl" />,
    title: 'Professional Services',
    description: 'Expert technical consulting and project delivery across multiple platforms',
    features: ['High/Low Level Design', 'Proof of Concept', 'Acceptance Testing', 'Multi-platform Systems'],
    href: '/services/professional-services',
    color: 'from-cyber-blue to-cyber-cyan',
  },
  {
    icon: <FaCloud className="text-5xl" />,
    title: 'Cloud & Infrastructure',
    description: 'Comprehensive cloud solutions across AWS, Azure, and Google Cloud Platform',
    features: ['Cloud Migration', 'Infrastructure Design', 'DevOps Automation', 'Datacenter Operations'],
    href: '/services/cloud-infrastructure',
    color: 'from-cyber-cyan to-cyber-purple',
  },
  {
    icon: <FaShieldAlt className="text-5xl" />,
    title: 'Cyber Security',
    description: 'Enterprise-grade security solutions and compliance management',
    features: ['Threat Defense', 'Compliance (SOX, PCI DSS)', 'Risk Assessment', 'Incident Response'],
    href: '/services/cyber-security',
    color: 'from-cyber-purple to-cyber-blue',
  },
  {
    icon: <FaServer className="text-5xl" />,
    title: 'Business Continuity',
    description: 'Comprehensive disaster recovery and business continuity planning',
    features: ['BCP Development', 'Disaster Recovery', 'Testing & Drills', 'RTO/RPO Optimization'],
    href: '/services/business-continuity',
    color: 'from-cyber-blue to-cyber-green',
  },
  {
    icon: <FaUsers className="text-5xl" />,
    title: 'Virtual Office',
    description: 'Remote infrastructure and secure collaboration solutions',
    features: ['Remote Infrastructure', 'Centralized Security', 'Access Controls', 'User Support'],
    href: '/services/virtual-office',
    color: 'from-cyber-green to-cyber-cyan',
  },
];

export default function ServicesCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resetTimeout = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };

  useEffect(() => {
    if (isAutoPlaying) {
      resetTimeout();
      timeoutRef.current = setTimeout(() => {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % services.length);
      }, 5000); // Auto-advance every 5 seconds
    }

    return () => {
      resetTimeout();
    };
  }, [currentIndex, isAutoPlaying]);

  const handlePrevious = () => {
    setIsAutoPlaying(false);
    setCurrentIndex((prevIndex) => (prevIndex - 1 + services.length) % services.length);
  };

  const handleNext = () => {
    setIsAutoPlaying(false);
    setCurrentIndex((prevIndex) => (prevIndex + 1) % services.length);
  };

  const handleDotClick = (index: number) => {
    setIsAutoPlaying(false);
    setCurrentIndex(index);
  };

  const currentService = services[currentIndex];

  return (
    <div className="relative w-full bg-dark-card border border-dark-border rounded-2xl overflow-hidden">
      {/* Background Gradient */}
      <div className={`absolute inset-0 bg-gradient-to-br ${currentService.color} opacity-5 transition-all duration-700`} />
      
      {/* Content */}
      <div className="relative z-10 p-8 md:p-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="space-y-6"
          >
            {/* Icon and Title */}
            <div className="flex items-center gap-6">
              <motion.div
                className={`text-cyber-blue`}
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              >
                {currentService.icon}
              </motion.div>
              <div>
                <h3 className="heading-md text-text-primary mb-2">{currentService.title}</h3>
                <p className="text-text-secondary text-lg">{currentService.description}</p>
              </div>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
              {currentService.features.map((feature, idx) => (
                <motion.div
                  key={feature}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + idx * 0.1 }}
                  className="flex items-center gap-3 bg-dark-lighter/50 rounded-lg p-4 border border-dark-border"
                >
                  <div className="w-2 h-2 bg-cyber-cyan rounded-full flex-shrink-0" />
                  <span className="text-text-primary font-medium">{feature}</span>
                </motion.div>
              ))}
            </div>

            {/* CTA Button */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="pt-6"
            >
              <Link href={currentService.href} className="btn-primary">
                <span>Explore Service</span>
              </Link>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation Controls */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 lg:left-auto lg:right-8 lg:translate-x-0 flex flex-col lg:flex-row items-center gap-4 z-20">
        {/* Dot Indicators */}
        <div className="flex gap-2 order-2 lg:order-1">
          {services.map((_, idx) => (
            <button
              key={idx}
              onClick={() => handleDotClick(idx)}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                idx === currentIndex 
                  ? 'bg-cyber-blue w-8' 
                  : 'bg-dark-border hover:bg-cyber-blue/50'
              }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>

        {/* Arrow Buttons */}
        <div className="flex gap-2 order-1 lg:order-2">
          <button
            onClick={handlePrevious}
            className="w-10 h-10 rounded-full bg-dark-lighter border border-dark-border hover:border-cyber-blue 
                     flex items-center justify-center text-text-secondary hover:text-cyber-blue transition-all duration-300
                     hover:shadow-[0_0_20px_rgba(0,217,255,0.3)]"
            aria-label="Previous service"
          >
            <FaChevronLeft />
          </button>
          <button
            onClick={handleNext}
            className="w-10 h-10 rounded-full bg-dark-lighter border border-dark-border hover:border-cyber-blue 
                     flex items-center justify-center text-text-secondary hover:text-cyber-blue transition-all duration-300
                     hover:shadow-[0_0_20px_rgba(0,217,255,0.3)]"
            aria-label="Next service"
          >
            <FaChevronRight />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      {isAutoPlaying && (
        <motion.div
          className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-cyber-blue to-cyber-cyan"
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{ duration: 5, ease: 'linear' }}
          key={currentIndex}
        />
      )}
    </div>
  );
}
