'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { FaSearch, FaTimes } from 'react-icons/fa';
import { searchAdmin } from '@/lib/admin-search';
import { motion, AnimatePresence } from 'framer-motion';

export default function AdminSearch() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
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
        onClick={() => setIsOpen(true)}
        className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-dark-lighter border border-dark-border 
                 hover:border-cyber-green text-text-secondary hover:text-cyber-green transition-colors 
                 text-sm hidden sm:flex"
        title="Search settings (Ctrl+K)"
      >
        <FaSearch className="text-sm" />
        <span className="hidden md:inline">Search...</span>
        <kbd className="ml-2 text-xs px-2 py-1 rounded bg-dark-border text-text-muted">⌘K</kbd>
      </button>

      {/* Mobile Search Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="sm:hidden p-2 rounded-lg text-text-secondary hover:text-cyber-green hover:bg-dark-lighter transition-colors"
        title="Search settings"
      >
        <FaSearch className="text-lg" />
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
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed top-20 left-1/2 -translate-x-1/2 w-full max-w-2xl z-50 px-4"
            >
              <div className="bg-dark-card border border-dark-border rounded-xl shadow-2xl overflow-hidden">
                {/* Search Input */}
                <div className="flex items-center border-b border-dark-border px-4 py-3">
                  <FaSearch className="text-text-muted mr-3" />
                  <input
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
                    className="text-text-muted hover:text-text-primary"
                  >
                    <FaTimes />
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
