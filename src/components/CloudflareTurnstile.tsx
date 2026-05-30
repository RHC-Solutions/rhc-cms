'use client';

import { useEffect, useRef, useState } from 'react';

interface TurnstileWidget {
  render: (element: HTMLElement | string, options: any) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileWidget;
    turnstileScriptLoaded?: boolean;
  }
}

interface CloudflareTurnstileProps {
  onVerify: (token: string) => void;
  onError?: () => void;
  theme?: 'light' | 'dark';
  size?: 'normal' | 'compact';
}

export default function CloudflareTurnstile({ onVerify, onError, theme = 'dark', size = 'normal' }: CloudflareTurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);

  useEffect(() => {
    // Check if script already exists globally
    if (window.turnstileScriptLoaded && window.turnstile) {
      setIsScriptLoaded(true);
      return;
    }

    // Check if script tag already exists in DOM
    const existingScript = document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => {
        window.turnstileScriptLoaded = true;
        setIsScriptLoaded(true);
      });
      return;
    }

    // Load Turnstile script only once
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;

    script.onload = () => {
      window.turnstileScriptLoaded = true;
      setIsScriptLoaded(true);
    };

    script.onerror = () => {
      console.error('[Turnstile] Failed to load script');
      onError?.();
    };

    document.head.appendChild(script);

    // Cleanup only removes widget, not script (script persists for reuse)
    return () => {
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        } catch (error) {
          console.error('[Turnstile] Cleanup error:', error);
        }
      }
    };
  }, [onError]);

  useEffect(() => {
    // Don't render if script not loaded or container not ready
    if (!isScriptLoaded || !containerRef.current || !window.turnstile) {
      return;
    }

    // Don't render if already rendered
    if (widgetIdRef.current) {
      return;
    }

    try {
      // Get sitekey from window object (injected by Next.js)
      const siteKey = process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY;
      
      if (!siteKey || typeof siteKey !== 'string') {
        console.error('[Turnstile] Site key not configured or invalid type');
        return;
      }

      // Render Turnstile widget
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme,
        size,
        callback: (token: string) => {
          onVerify(token);
        },
        'error-callback': () => {
          onError?.();
        },
      });
    } catch (error) {
      console.error('[Turnstile] Render error:', error);
      onError?.();
    }
  }, [isScriptLoaded, onVerify, onError, theme, size]);

  return <div ref={containerRef} className="cf-turnstile" />;
}
