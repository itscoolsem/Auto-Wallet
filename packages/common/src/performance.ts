/**
 * Performance monitoring utilities
 */

export class Timer {
  private startTime: number;
  private endTime?: number;

  constructor(private label: string) {
    this.startTime = performance.now();
  }

  stop(): number {
    this.endTime = performance.now();
    const duration = this.endTime - this.startTime;
    return duration;
  }

  log(): void {
    const duration = this.stop();
    console.log(`[Timer] ${this.label}: ${duration.toFixed(2)}ms`);
  }
}

export function time<T>(label: string, fn: () => T): T {
  const timer = new Timer(label);
  try {
    const result = fn();
    timer.log();
    return result;
  } catch (error) {
    timer.log();
    throw error;
  }
}

export async function timeAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const timer = new Timer(label);
  try {
    const result = await fn();
    timer.log();
    return result;
  } catch (error) {
    timer.log();
    throw error;
  }
}

interface PerformanceMetrics {
  count: number;
  totalTime: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
}

export class PerformanceTracker {
  private metrics = new Map<string, number[]>();

  track(label: string, duration: number): void {
    if (!this.metrics.has(label)) {
      this.metrics.set(label, []);
    }
    this.metrics.get(label)!.push(duration);
  }

  getMetrics(label: string): PerformanceMetrics | null {
    const durations = this.metrics.get(label);
    if (!durations || durations.length === 0) {
      return null;
    }

    const totalTime = durations.reduce((sum, d) => sum + d, 0);
    return {
      count: durations.length,
      totalTime,
      avgTime: totalTime / durations.length,
      minTime: Math.min(...durations),
      maxTime: Math.max(...durations),
    };
  }

  getAllMetrics(): Record<string, PerformanceMetrics> {
    const result: Record<string, PerformanceMetrics> = {};
    for (const label of this.metrics.keys()) {
      const metrics = this.getMetrics(label);
      if (metrics) {
        result[label] = metrics;
      }
    }
    return result;
  }

  clear(): void {
    this.metrics.clear();
  }
}