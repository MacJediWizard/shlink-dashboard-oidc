import { createLogger } from '../../app/utils/logger.server';

describe('logger', () => {
  const originalEnv = process.env.NODE_ENV;
  let consoleSpy: {
    debug: ReturnType<typeof vi.spyOn>;
    info: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    consoleSpy = {
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    vi.restoreAllMocks();
  });

  describe('createLogger', () => {
    it('creates a logger with the specified component name', () => {
      const logger = createLogger('TestComponent');

      logger.info('Test message');

      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('[INFO] [TestComponent] Test message'),
      );
    });

    it('includes timestamp in log messages', () => {
      const logger = createLogger('Test');

      logger.info('Test message');

      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
      );
    });

    it('includes data in log messages when provided', () => {
      const logger = createLogger('Test');

      logger.info('Test message', { key: 'value', num: 123 });

      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('{"key":"value","num":123}'),
      );
    });
  });

  describe('log levels', () => {
    it('logs debug messages only in non-production', () => {
      process.env.NODE_ENV = 'development';
      const logger = createLogger('Test');

      logger.debug('Debug message');

      expect(consoleSpy.debug).toHaveBeenCalled();
    });

    it('does not log debug messages in production', () => {
      process.env.NODE_ENV = 'production';
      const logger = createLogger('Test');

      logger.debug('Debug message');

      expect(consoleSpy.debug).not.toHaveBeenCalled();
    });

    it('logs info messages', () => {
      const logger = createLogger('Test');

      logger.info('Info message');

      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('[INFO] [Test] Info message'),
      );
    });

    it('logs warn messages', () => {
      const logger = createLogger('Test');

      logger.warn('Warning message');

      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('[WARN] [Test] Warning message'),
      );
    });

    it('logs error messages', () => {
      const logger = createLogger('Test');

      logger.error('Error message');

      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR] [Test] Error message'),
      );
    });
  });
});
