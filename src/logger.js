/**
 * Simple console logger with timestamps and colored log levels.
 */

const COLORS = {
  reset:   '\x1b[0m',
  gray:    '\x1b[90m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  red:     '\x1b[31m',
  cyan:    '\x1b[36m',
  magenta: '\x1b[35m',
};

/**
 * Format a timestamp as ISO-like local time: YYYY-MM-DD HH:mm:ss
 * @returns {string}
 */
function timestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

/**
 * Format and print a log line.
 * @param {'INFO'|'WARN'|'ERROR'|'DEBUG'} level
 * @param {string} color
 * @param {string} message
 * @param {any[]} args
 */
function log(level, color, message, ...args) {
  const ts = `${COLORS.gray}${timestamp()}${COLORS.reset}`;
  const lvl = `${color}${level.padEnd(5)}${COLORS.reset}`;
  console.log(`${ts}  ${lvl}  ${message}`, ...args);
}

const logger = {
  info:  (msg, ...args) => log('INFO',  COLORS.green,   msg, ...args),
  warn:  (msg, ...args) => log('WARN',  COLORS.yellow,  msg, ...args),
  error: (msg, ...args) => log('ERROR', COLORS.red,     msg, ...args),
  debug: (msg, ...args) => log('DEBUG', COLORS.cyan,    msg, ...args),
  steam: (msg, ...args) => log('STEAM', COLORS.magenta, msg, ...args),
};

export default logger;
