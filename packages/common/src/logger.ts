export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

export interface Logger {
  error(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  info(message: string, meta?: unknown): void;
  debug(message: string, meta?: unknown): void;
}

class ConsoleLogger implements Logger {
  constructor(private level: LogLevel = LogLevel.INFO) {}

  error(message: string, meta?: unknown): void {
    if (this.level >= LogLevel.ERROR) {
      console.error(`[ERROR] ${message}`, meta ? JSON.stringify(meta) : '');
    }
  }

  warn(message: string, meta?: unknown): void {
    if (this.level >= LogLevel.WARN) {
      console.warn(`[WARN] ${message}`, meta ? JSON.stringify(meta) : '');
    }
  }

  info(message: string, meta?: unknown): void {
    if (this.level >= LogLevel.INFO) {
      console.info(`[INFO] ${message}`, meta ? JSON.stringify(meta) : '');
    }
  }

  debug(message: string, meta?: unknown): void {
    if (this.level >= LogLevel.DEBUG) {
      console.debug(`[DEBUG] ${message}`, meta ? JSON.stringify(meta) : '');
    }
  }
}

export function createLogger(level: LogLevel = LogLevel.INFO): Logger {
  return new ConsoleLogger(level);
}