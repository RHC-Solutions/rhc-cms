'use client';

import { useState, useEffect } from 'react';

interface TypingEffectProps {
  text: string;
  speed?: number;
  delay?: number;
  className?: string;
  onComplete?: () => void;
}

export default function TypingEffect({ 
  text, 
  speed = 50, 
  delay = 0, 
  className = '',
  onComplete 
}: TypingEffectProps) {
  // PERFORMANCE FIX: Disable typing animation to prevent CLS
  // Render text instantly for better performance
  useEffect(() => {
    if (onComplete) {
      // Call onComplete immediately since we're not animating
      onComplete();
    }
  }, [onComplete]);

  // Just render the full text immediately
  return (
    <span className={className}>
      {text}
    </span>
  );
}
