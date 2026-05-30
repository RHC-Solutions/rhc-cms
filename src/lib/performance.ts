/**
 * Performance monitoring utilities
 * Helps identify slow operations and bottlenecks
 */

export interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private readonly maxMetrics = 1000; // Keep last 1000 metrics
  private slowOperationThreshold = 1000; // 1 second

  /**
   * Measure the duration of an async operation
   */
  async measure<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const start = Date.now();
    
    try {
      const result = await fn();
      const duration = Date.now() - start;
      
      this.recordMetric({
        operation,
        duration,
        timestamp: start,
        metadata,
      });

      if (duration > this.slowOperationThreshold) {
        console.warn(
          `[PERF] Slow operation detected: ${operation} took ${duration}ms`,
          metadata
        );
      }

      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.recordMetric({
        operation: `${operation} (ERROR)`,
        duration,
        timestamp: start,
        metadata: { ...metadata, error: String(error) },
      });
      throw error;
    }
  }

  /**
   * Measure the duration of a synchronous operation
   */
  measureSync<T>(
    operation: string,
    fn: () => T,
    metadata?: Record<string, any>
  ): T {
    const start = Date.now();
    
    try {
      const result = fn();
      const duration = Date.now() - start;
      
      this.recordMetric({
        operation,
        duration,
        timestamp: start,
        metadata,
      });

      if (duration > this.slowOperationThreshold) {
        console.warn(
          `[PERF] Slow operation detected: ${operation} took ${duration}ms`,
          metadata
        );
      }

      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.recordMetric({
        operation: `${operation} (ERROR)`,
        duration,
        timestamp: start,
        metadata: { ...metadata, error: String(error) },
      });
      throw error;
    }
  }

  /**
   * Start a timer for manual timing
   */
  startTimer(operation: string): () => void {
    const start = Date.now();
    
    return (metadata?: Record<string, any>) => {
      const duration = Date.now() - start;
      this.recordMetric({
        operation,
        duration,
        timestamp: start,
        metadata,
      });

      if (duration > this.slowOperationThreshold) {
        console.warn(
          `[PERF] Slow operation detected: ${operation} took ${duration}ms`,
          metadata
        );
      }
    };
  }

  /**
   * Record a metric
   */
  private recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);
    
    // Keep only last N metrics to prevent memory issues
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }
  }

  /**
   * Get performance statistics
   */
  getStats(operation?: string): {
    count: number;
    avgDuration: number;
    minDuration: number;
    maxDuration: number;
    p95Duration: number;
    p99Duration: number;
  } {
    let metrics = this.metrics;
    
    if (operation) {
      metrics = metrics.filter(m => m.operation === operation);
    }

    if (metrics.length === 0) {
      return {
        count: 0,
        avgDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        p95Duration: 0,
        p99Duration: 0,
      };
    }

    const durations = metrics.map(m => m.duration).sort((a, b) => a - b);
    const sum = durations.reduce((a, b) => a + b, 0);

    return {
      count: metrics.length,
      avgDuration: sum / metrics.length,
      minDuration: durations[0],
      maxDuration: durations[durations.length - 1],
      p95Duration: durations[Math.floor(durations.length * 0.95)],
      p99Duration: durations[Math.floor(durations.length * 0.99)],
    };
  }

  /**
   * Get all recent metrics
   */
  getRecentMetrics(limit: number = 100): PerformanceMetric[] {
    return this.metrics.slice(-limit);
  }

  /**
   * Get slow operations (above threshold)
   */
  getSlowOperations(limit: number = 50): PerformanceMetric[] {
    return this.metrics
      .filter(m => m.duration > this.slowOperationThreshold)
      .slice(-limit);
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = [];
  }

  /**
   * Set slow operation threshold (in milliseconds)
   */
  setSlowOperationThreshold(threshold: number): void {
    this.slowOperationThreshold = threshold;
  }

  /**
   * Get list of all tracked operations
   */
  getOperations(): string[] {
    const operations = new Set(this.metrics.map(m => m.operation));
    return Array.from(operations).sort();
  }

  /**
   * Get performance report
   */
  getReport(): string {
    const operations = this.getOperations();
    let report = '=== Performance Report ===\n\n';
    
    for (const operation of operations) {
      const stats = this.getStats(operation);
      report += `${operation}:\n`;
      report += `  Count: ${stats.count}\n`;
      report += `  Avg: ${stats.avgDuration.toFixed(2)}ms\n`;
      report += `  Min: ${stats.minDuration}ms\n`;
      report += `  Max: ${stats.maxDuration}ms\n`;
      report += `  P95: ${stats.p95Duration}ms\n`;
      report += `  P99: ${stats.p99Duration}ms\n\n`;
    }

    const slowOps = this.getSlowOperations();
    if (slowOps.length > 0) {
      report += `\nSlow Operations (>${this.slowOperationThreshold}ms):\n`;
      slowOps.forEach(op => {
        report += `  ${op.operation}: ${op.duration}ms\n`;
      });
    }

    return report;
  }
}

// Export singleton instance
export const perfMonitor = new PerformanceMonitor();

// Helper function for quick measurements
export async function measurePerf<T>(
  operation: string,
  fn: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  return perfMonitor.measure(operation, fn, metadata);
}

// Store interval ID for cleanup
let reportIntervalId: NodeJS.Timeout | null = null;

// Log performance report every 5 minutes in development
if (process.env.NODE_ENV === 'development' && typeof setInterval !== 'undefined') {
  reportIntervalId = setInterval(() => {
    const report = perfMonitor.getReport();
    if (perfMonitor.getStats().count > 0) {
      console.log('[PERF] Performance Report:\n', report);
    }
  }, 5 * 60 * 1000); // 5 minutes
}

// Cleanup function to stop the interval
export function stopPerformanceReporting(): void {
  if (reportIntervalId) {
    clearInterval(reportIntervalId);
    reportIntervalId = null;
  }
}
