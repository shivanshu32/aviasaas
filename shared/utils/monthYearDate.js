/**
 * Medicine batch expiry / manufacturing month-year helpers.
 * UI uses <input type="month"> (YYYY-MM). DB stores Date:
 * - expiryDate → last moment of that calendar month (pharma standard)
 * - mfgDate → first day of month at local noon
 * Legacy full dates (YYYY-MM-DD / ISO) are accepted for read/backward compatibility.
 */

/** @returns {{ year: number, monthIndex: number } | null} monthIndex 0–11 */
export function parseMonthYearParts(value) {
  if (value == null || value === '') return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return { year: value.getFullYear(), monthIndex: value.getMonth() };
  }

  const s = String(value).trim();

  let m = s.match(/^(\d{4})-(\d{2})$/);
  if (m) {
    const year = parseInt(m[1], 10);
    const monthIndex = parseInt(m[2], 10) - 1;
    if (monthIndex < 0 || monthIndex > 11 || Number.isNaN(year)) return null;
    return { year, monthIndex };
  }

  m = s.match(/^(\d{4})-(\d{2})-\d{2}/);
  if (m) {
    const year = parseInt(m[1], 10);
    const monthIndex = parseInt(m[2], 10) - 1;
    if (monthIndex < 0 || monthIndex > 11 || Number.isNaN(year)) return null;
    return { year, monthIndex };
  }

  const parsed = new Date(s);
  if (Number.isNaN(parsed.getTime())) return null;
  return { year: parsed.getFullYear(), monthIndex: parsed.getMonth() };
}

/** Last instant of the expiry month (local time). */
export function endOfExpiryMonth(value) {
  const parts = parseMonthYearParts(value);
  if (!parts) return null;
  return new Date(parts.year, parts.monthIndex + 1, 0, 23, 59, 59, 999);
}

/** First day of manufacturing month at local noon. */
export function startOfMfgMonth(value) {
  const parts = parseMonthYearParts(value);
  if (!parts) return null;
  return new Date(parts.year, parts.monthIndex, 1, 12, 0, 0, 0);
}

/** Display as "Jun 2026". */
export function formatMonthYear(value) {
  const parts = parseMonthYearParts(value);
  if (!parts) return '—';
  const d = new Date(parts.year, parts.monthIndex, 1);
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

/** Value for <input type="month"> — YYYY-MM */
export function toMonthInputValue(value) {
  const parts = parseMonthYearParts(value);
  if (!parts) return '';
  return `${parts.year}-${String(parts.monthIndex + 1).padStart(2, '0')}`;
}

/** Whole days until end of expiry month (negative if expired). */
export function daysUntilExpiryEnd(value) {
  const end = endOfExpiryMonth(value);
  if (!end) return null;
  const now = new Date();
  return Math.ceil((end - now) / (1000 * 60 * 60 * 24));
}

/** True when today is after the expiry month. */
export function isExpiryMonthPast(value) {
  const days = daysUntilExpiryEnd(value);
  return days != null && days < 0;
}
