'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { FaExclamationTriangle, FaHome, FaArrowLeft } from 'react-icons/fa';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-cyber flex items-center justify-center relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-cyber-grid opacity-5" />
      <motion.div
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.2, 0.4, 0.2],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-cyber-blue/20 rounded-full blur-3xl"
      />
      <motion.div
        animate={{
          scale: [1.2, 1, 1.2],
          opacity: [0.2, 0.4, 0.2],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-cyber-red/20 rounded-full blur-3xl"
      />

      {/* Content */}
      <div className="container-custom relative z-10 py-32 px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-3xl mx-auto text-center"
        >
          {/* 404 Icon */}
          <motion.div
            animate={{
              rotate: [0, -5, 5, -5, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              repeatDelay: 3,
            }}
            className="inline-block mb-8"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-cyber-red/20 rounded-full blur-2xl" />
              <FaExclamationTriangle className="text-9xl text-cyber-red relative z-10" />
            </div>
          </motion.div>

          {/* 404 Number */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="mb-6"
          >
            <h1 className="text-8xl md:text-9xl font-bold text-mono">
              <span className="text-gradient">404</span>
            </h1>
          </motion.div>

          {/* Title */}
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="heading-lg mb-6"
          >
            Page <span className="text-gradient">Not Found</span>
          </motion.h2>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="text-xl text-text-secondary mb-8 max-w-2xl mx-auto"
          >
            The page you're looking for doesn't exist or has been moved. 
            Let's get you back on track.
          </motion.p>

          {/* Error Details Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.6 }}
            className="card-dark p-6 mb-10 inline-block"
          >
            <p className="text-mono text-cyber-red text-sm">
              <span className="text-text-muted">ERROR_CODE:</span> HTTP_404_NOT_FOUND
            </p>
            <p className="text-mono text-cyber-cyan text-sm mt-2">
              <span className="text-text-muted">STATUS:</span> RESOURCE_UNAVAILABLE
            </p>
          </motion.div>

          {/* Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 0.6 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link href="/" className="btn-cta inline-flex items-center justify-center space-x-2">
              <FaHome />
              <span>Go to Homepage</span>
            </Link>
            <button
              onClick={() => {
                if (typeof window !== 'undefined' && window.history.length > 1) {
                  window.history.back();
                } else {
                  window.location.href = '/';
                }
              }}
              aria-label="Go back to the previous page"
              className="btn-secondary inline-flex items-center justify-center space-x-2"
            >
              <FaArrowLeft aria-hidden="true" />
              <span>Go Back</span>
            </button>
          </motion.div>

          {/* Quick Links */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2, duration: 0.6 }}
            className="mt-12 pt-8 border-t border-dark-card"
          >
            <p className="text-sm text-text-muted mb-4">QUICK LINKS</p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link 
                href="/services" 
                className="text-cyber-blue hover:text-cyber-cyan transition-colors text-sm font-semibold"
              >
                Services
              </Link>
              <span className="text-text-muted">•</span>
              <Link 
                href="/about-us" 
                className="text-cyber-blue hover:text-cyber-cyan transition-colors text-sm font-semibold"
              >
                About Us
              </Link>
              <span className="text-text-muted">•</span>
              <Link 
                href="/clients" 
                className="text-cyber-blue hover:text-cyber-cyan transition-colors text-sm font-semibold"
              >
                Case Studies
              </Link>
              <span className="text-text-muted">•</span>
              <Link 
                href="/contact" 
                className="text-cyber-blue hover:text-cyber-cyan transition-colors text-sm font-semibold"
              >
                Contact
              </Link>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
