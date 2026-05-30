'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useInView, useMotionValue, useSpring } from 'framer-motion';

interface AnimatedStatProps {
  value: number;
  label: string;
  suffix?: string;
  prefix?: string;
  duration?: number;
  delay?: number;
}

export default function AnimatedStats({ 
  value, 
  label, 
  suffix = '', 
  prefix = '',
  duration = 2,
  delay = 0 
}: AnimatedStatProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });
  const [hasAnimated, setHasAnimated] = useState(false);

  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, {
    duration: duration * 1000,
    bounce: 0,
  });

  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (isInView && !hasAnimated) {
      const timeout = setTimeout(() => {
        motionValue.set(value);
        setHasAnimated(true);
      }, delay * 1000);

      return () => clearTimeout(timeout);
    }
  }, [isInView, value, motionValue, delay, hasAnimated]);

  useEffect(() => {
    const unsubscribe = springValue.on('change', (latest) => {
      setDisplayValue(Math.round(latest));
    });

    return () => unsubscribe();
  }, [springValue]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{ duration: 0.6, delay }}
      className="text-center group"
      layout="position"
    >
      <div className="relative inline-block min-h-[80px] flex items-center justify-center">
        <div
          className="text-5xl md:text-6xl font-bold text-gradient mb-2"
        >
          {prefix}{displayValue}{suffix}
        </div>
      </div>

      <p className="text-text-secondary text-lg mt-2 group-hover:text-text-primary transition-colors duration-300">
        {label}
      </p>
    </motion.div>
  );
}

interface AnimatedStatsGridProps {
  stats: Array<{
    value: number;
    label: string;
    suffix?: string;
    prefix?: string;
  }>;
  columns?: 2 | 3 | 4;
}

export function AnimatedStatsGrid({ stats, columns = 4 }: AnimatedStatsGridProps) {
  const gridCols = {
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-4',
  };

  return (
    <div className={`grid ${gridCols[columns]} gap-8 md:gap-12`}>
      {stats.map((stat, index) => (
        <AnimatedStats
          key={stat.label}
          value={stat.value}
          label={stat.label}
          suffix={stat.suffix}
          prefix={stat.prefix}
          delay={index * 0.1}
        />
      ))}
    </div>
  );
}
