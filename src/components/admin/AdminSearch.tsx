'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { FaSearch, FaTimes } from 'react-icons/fa';
import { searchAdmin } from '@adminpanel/lib/admin-search';
import { motion, AnimatePresence } from 'framer-motion';

export default function AdminSearch() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  // Shown in the trigger; set after mount so server and client markup agree.
  const [shortcut, setShortcut] = useState('Ctrl K');
  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) setShortcut('⌘K');
  }, []);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcut: Ctrl+K or Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        setQuery('');
        setSelectedIndex(0);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setQuery('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Handle search
  useEffect(() => {
    if (query.trim()) {
      const searchResults = searchAdmin(query);
      setResults(searchResults as any);
      setSelectedIndex(0);
    } else {
      setResults([]);
      setSelectedIndex(0);
    }
  }, [query]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Enter' && results.length > 0) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    }
  }, [results, selectedIndex]);

  const handleSelect = (item: any) => {
    router.push(item.href);
    setIsOpen(false);
    setQuery('');
  };

  return (
    <>
      {/* Search Button in Top Bar */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label={`Search admin (${shortcut})`}
        className="hidden sm:flex items-center gap-2 h-9 pl-3 pr-2 rounded-lg border border-dark-border bg-dark-card
                 text-sm text-text-muted hover:text-text-primary hover:border-[var(--adm-border-ctl)] transition-colors"
      >
        <FaSearch className="text-xs" aria-hidden="true" />
        <span className="hidden md:inline pr-6">Search…</span>
        <kbd className="hidden md:inline text-xs px-1.5 py-0.5 rounded border border-dark-border text-text-muted font-sans">{shortcut}</kbd>
      </button>

      {/* Mobile Search Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Search admin"
        className="sm:hidden grid place-items-center w-9 h-9 rounded-lg text-text-secondary hover:text-text-primary hover:bg-dark-lighter transition-colors"
      >
        <FaSearch aria-hidden="true" />
      </button>

      {/* Search Modal */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/50 z-40"
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="fixed top-20 left-1/2 -translate-x-1/2 w-full max-w-2xl z-50 px-4"
            >
              <div className="bg-dark-card border border-dark-border rounded-xl shadow-2xl overflow-hidden">
                {/* Search Input */}
                <div className="flex items-center border-b border-dark-border px-4 py-3">
                  <FaSearch className="text-text-muted mr-3" aria-hidden="true" />
                  <input
                    aria-label="Search settings, pages and forms"
                    ref={inputRef}
                    type="text"
                    placeholder="Search settings, pages, forms... (Ctrl+K)"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="flex-1 bg-transparent text-text-primary outline-none placeholder-text-muted"
                  />
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      setQuery('');
                    }}
                    aria-label="Close search"
                    className="grid place-items-center w-7 h-7 rounded-md text-text-muted hover:text-text-primary hover:bg-dark-lighter"
                  >
                    <FaTimes aria-hidden="true" />
                  </button>
                </div>

                {/* Results */}
                <div ref={resultsRef} className="max-h-96 overflow-y-auto">
                  {results.length > 0 ? (
                    <div className="divide-y divide-dark-border">
                      {results.map((item: any, index: number) => (
                        <motion.button
                          key={item.id}
                          onClick={() => handleSelect(item)}
                          onMouseEnter={() => setSelectedIndex(index)}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className={`w-full text-left px-4 py-3 transition-colors ${
                            selectedIndex === index
                              ? 'bg-cyber-green/20 border-l-2 border-cyber-green'
                              : 'hover:bg-dark-lighter'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-semibold text-text-primary">{item.title}</p>
                              <p className="text-sm text-text-muted">{item.description}</p>
                            </div>
                            <span className="text-xs text-text-muted ml-2 whitespace-nowrap">
                              {item.href}
                            </span>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  ) : query ? (
                    <div className="px-4 py-8 text-center text-text-muted">
                      <p>No results found for "{query}"</p>
                    </div>
                  ) : (
                    <div className="px-4 py-8 text-center text-text-muted">
                      <p>Start typing to search...</p>
                    </div>
                  )}
                </div>

                {/* Footer */}
                {results.length > 0 && (
                  <div className="border-t border-dark-border bg-dark-lighter px-4 py-2 text-xs text-text-muted flex items-center justify-between">
                    <span>
                      <kbd className="px-2 py-1 rounded bg-dark-border text-text-muted mr-2">↑↓</kbd>
                      Navigate
                      <kbd className="px-2 py-1 rounded bg-dark-border text-text-muted ml-2 mr-2">Enter</kbd>
                      Select
                      <kbd className="px-2 py-1 rounded bg-dark-border text-text-muted ml-2">Esc</kbd>
                      Close
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
