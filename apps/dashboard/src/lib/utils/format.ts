/**
 * Formatting utilities for the AgentBeam dashboard.
 */

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const currencyFormatterPrecise = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 6,
});

/**
 * Format a number as USD currency.
 * Small amounts (<$0.01) show up to 6 decimal places to avoid showing $0.00.
 * @example formatCurrency(0) => "$0.00"
 * @example formatCurrency(1.234) => "$1.23"
 * @example formatCurrency(1234.56) => "$1,234.56"
 * @example formatCurrency(0.000123) => "$0.000123"
 */
export function formatCurrency(amount: number): string {
  if (amount === 0) return '$0.00';
  if (Math.abs(amount) < 0.01) {
    return currencyFormatterPrecise.format(amount);
  }
  return currencyFormatter.format(amount);
}

/**
 * Format a token count with human-readable suffixes.
 * @example formatTokens(0) => "0"
 * @example formatTokens(999) => "999"
 * @example formatTokens(1200) => "1.2K"
 * @example formatTokens(3400000) => "3.4M"
 * @example formatTokens(1500000000) => "1.5B"
 */
export function formatTokens(count: number): string {
  if (count === 0) return '0';
  if (Math.abs(count) < 1_000) return Math.round(count).toString();
  if (Math.abs(count) < 1_000_000) {
    const k = count / 1_000;
    return `${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}K`;
  }
  if (Math.abs(count) < 1_000_000_000) {
    const m = count / 1_000_000;
    return `${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  const b = count / 1_000_000_000;
  return `${b % 1 === 0 ? b.toFixed(0) : b.toFixed(1)}B`;
}

/**
 * Format a duration in milliseconds to a human-readable string.
 * @example formatDuration(50) => "50ms"
 * @example formatDuration(1200) => "1.2s"
 * @example formatDuration(150000) => "2m 30s"
 * @example formatDuration(3661000) => "1h 1m"
 */
export function formatDuration(ms: number): string {
  if (ms < 1_000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) {
    const s = ms / 1_000;
    return `${s % 1 === 0 ? s.toFixed(0) : s.toFixed(1)}s`;
  }
  if (ms < 3_600_000) {
    const totalSeconds = Math.floor(ms / 1_000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

/**
 * Format a date as a relative time string.
 * @example formatRelativeTime(new Date(Date.now() - 120000)) => "2m ago"
 * @example formatRelativeTime(new Date(Date.now() - 7200000)) => "2h ago"
 * @example formatRelativeTime(new Date(Date.now() - 259200000)) => "3d ago"
 */
export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = Date.now();
  const diffMs = now - d.getTime();

  if (diffMs < 0) return 'just now';

  const seconds = Math.floor(diffMs / 1_000);
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

/**
 * Format a number with human-readable suffixes.
 * @example formatNumber(0) => "0"
 * @example formatNumber(1234) => "1,234"
 * @example formatNumber(1200000) => "1.2M"
 * @example formatNumber(1500000000) => "1.5B"
 */
export function formatNumber(n: number): string {
  if (n === 0) return '0';
  if (Math.abs(n) < 10_000) {
    return new Intl.NumberFormat('en-US').format(n);
  }
  if (Math.abs(n) < 1_000_000) {
    const k = n / 1_000;
    return `${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}K`;
  }
  if (Math.abs(n) < 1_000_000_000) {
    const m = n / 1_000_000;
    return `${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  const b = n / 1_000_000_000;
  return `${b % 1 === 0 ? b.toFixed(0) : b.toFixed(1)}B`;
}
