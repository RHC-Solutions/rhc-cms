'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaQuoteLeft, FaStar, FaChevronLeft, FaChevronRight } from 'react-icons/fa';

interface Testimonial {
  quote: string;
  author: string;
  position: string;
  company: string;
  industry: string;
  rating: number;
}

const testimonials: Testimonial[] = [
  {
    quote: "RHC Solutions transformed our infrastructure completely. Their expertise in cloud migration and security compliance was instrumental in our global expansion.",
    author: "Michael Chen",
    position: "CTO",
    company: "Global Trading Corp",
    industry: "Financial Services",
    rating: 5,
  },
  {
    quote: "Outstanding professional services. The team delivered a complex multi-platform solution on time and within budget. Their attention to detail is exceptional.",
    author: "Sarah Martinez",
    position: "VP of IT",
    company: "AeroTech Industries",
    industry: "Aerospace",
    rating: 5,
  },
  {
    quote: "Their cyber security and compliance expertise gave us the confidence to expand into new markets. RHC Solutions is a true partner in our success.",
    author: "David Thompson",
    position: "Head of Security",
    company: "BetWin Gaming",
    industry: "Gambling & Betting",
    rating: 5,
  },
  {
    quote: "The business continuity planning and disaster recovery solutions they implemented have proven invaluable. We sleep better knowing our systems are protected.",
    author: "Elena Popescu",
    position: "COO",
    company: "TechFlow Solutions",
    industry: "Technology",
    rating: 5,
  },
];

export default function TestimonialsCarousel() {
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
        setCurrentIndex((prevIndex) => (prevIndex + 1) % testimonials.length);
      }, 6000); // Auto-advance every 6 seconds
    }

    return () => {
      resetTimeout();
    };
  }, [currentIndex, isAutoPlaying]);

  const handlePrevious = () => {
    setIsAutoPlaying(false);
    setCurrentIndex((prevIndex) => (prevIndex - 1 + testimonials.length) % testimonials.length);
  };

  const handleNext = () => {
    setIsAutoPlaying(false);
    setCurrentIndex((prevIndex) => (prevIndex + 1) % testimonials.length);
  };

  const handleDotClick = (index: number) => {
    setIsAutoPlaying(false);
    setCurrentIndex(index);
  };

  const currentTestimonial = testimonials[currentIndex];

  return (
    <section className="section-padding bg-dark-lighter relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-cyber-grid opacity-10" />
      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-1/2 h-1/2 bg-cyber-blue/5 rounded-full blur-3xl" />
      
      <div className="container-custom relative z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="heading-lg mb-6">
            What Our <span className="text-gradient">Clients Say</span>
          </h2>
          <p className="text-text-secondary text-xl max-w-3xl mx-auto">
            Trusted by industry leaders across the globe for over 30 years
          </p>
        </motion.div>

        {/* Testimonial Card */}
        <div className="max-w-5xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.5 }}
              className="card-cyber p-8 md:p-12"
            >
              {/* Quote Icon */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring' }}
                className="mb-6"
              >
                <FaQuoteLeft className="text-4xl text-cyber-blue/30" />
              </motion.div>

              {/* Quote */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-text-primary text-xl md:text-2xl leading-relaxed mb-8 italic"
              >
                "{currentTestimonial.quote}"
              </motion.p>

              {/* Rating */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="flex gap-1 mb-6"
              >
                {Array.from({ length: currentTestimonial.rating }).map((_, idx) => (
                  <FaStar key={`star-${currentIndex}-${idx}`} className="text-cyber-green text-xl" />
                ))}
              </motion.div>

              {/* Author Info */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="border-t border-dark-border pt-6"
              >
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <p className="text-text-primary font-bold text-lg">{currentTestimonial.author}</p>
                    <p className="text-text-secondary text-sm">
                      {currentTestimonial.position} at {currentTestimonial.company}
                    </p>
                  </div>
                  <div className="px-4 py-2 bg-dark-card border border-cyber-blue/30 rounded-full">
                    <span className="text-cyber-cyan text-sm font-mono">{currentTestimonial.industry}</span>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </AnimatePresence>

          {/* Navigation Controls */}
          <div className="flex items-center justify-center gap-6 mt-8">
            {/* Arrow Buttons */}
            <button
              type="button"
              onClick={handlePrevious}
              className="w-12 h-12 rounded-full bg-dark-card border border-dark-border hover:border-cyber-blue 
                       flex items-center justify-center text-text-secondary hover:text-cyber-blue transition-all duration-300
                       hover:shadow-[0_0_20px_rgba(0,217,255,0.3)]"
              aria-label="Previous testimonial"
            >
              <FaChevronLeft />
            </button>

            {/* Dot Indicators */}
            <div className="flex gap-2">
              {testimonials.map((_, idx) => (
                <button
                  key={`dot-${idx}`}
                  type="button"
                  onClick={() => handleDotClick(idx)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    idx === currentIndex 
                      ? 'bg-cyber-blue w-12' 
                      : 'bg-dark-border hover:bg-cyber-blue/50 w-2'
                  }`}
                  aria-label={`Go to testimonial ${idx + 1}`}
                />
              ))}
            </div>

            {/* Arrow Buttons */}
            <button
              type="button"
              onClick={handleNext}
              className="w-12 h-12 rounded-full bg-dark-card border border-dark-border hover:border-cyber-blue 
                       flex items-center justify-center text-text-secondary hover:text-cyber-blue transition-all duration-300
                       hover:shadow-[0_0_20px_rgba(0,217,255,0.3)]"
              aria-label="Next testimonial"
            >
              <FaChevronRight />
            </button>
          </div>

          {/* Progress Bar */}
          {isAutoPlaying && (
            <motion.div
              className="mx-auto mt-6 h-1 bg-gradient-to-r from-cyber-blue to-cyber-cyan rounded-full max-w-md"
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ duration: 6, ease: 'linear' }}
              key={`progress-${currentIndex}`}
            />
          )}
        </div>
      </div>
    </section>
  );
}
