type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

const formatTimestamp = () => new Date().toISOString();

const formatMessage = (level: LogLevel, component: string, message: string, data?: Record<string, unknown>) => {
  const timestamp = formatTimestamp();
  const dataStr = data ? ` ${JSON.stringify(data)}` : '';
  return `[${timestamp}] [${level}] [${component}] ${message}${dataStr}`;
};

export const createLogger = (component: string) => ({
  debug: (message: string, data?: Record<string, unknown>) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(formatMessage('DEBUG', component, message, data));
    }
  },
  info: (message: string, data?: Record<string, unknown>) => {
    console.info(formatMessage('INFO', component, message, data));
  },
  warn: (message: string, data?: Record<string, unknown>) => {
    console.warn(formatMessage('WARN', component, message, data));
  },
  error: (message: string, data?: Record<string, unknown>) => {
    console.error(formatMessage('ERROR', component, message, data));
  },
});

export type Logger = ReturnType<typeof createLogger>;
