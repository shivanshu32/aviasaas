/**
 * Bill date helpers for <input type="date"> (YYYY-MM-DD) and MongoDB storage.
 * Parses calendar dates in local time to avoid UTC midnight shifting the day (e.g. IST).
 */

/** @returns {string} YYYY-MM-DD in local timezone */
export function getLocalDateInputString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Parse date from billing form or API (YYYY-MM-DD or ISO string).
 * Stored at local noon so list/print show the intended calendar day.
 * @returns {Date | null}
 */
export function parseBillDateInput(value) {
  if (value == null || value === '') return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const s = String(value).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const y = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10) - 1;
    const d = parseInt(m[3], 10);
    const date = new Date(y, mo, d, 12, 0, 0, 0);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Start of local calendar day for a Date or YYYY-MM-DD string */
export function startOfLocalDay(value) {
  const base = typeof value === 'string' ? parseBillDateInput(value) : new Date(value);
  if (!base || Number.isNaN(base.getTime())) return null;
  const d = new Date(base);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** End of local calendar day for a Date or YYYY-MM-DD string */
export function endOfLocalDay(value) {
  const base = typeof value === 'string' ? parseBillDateInput(value) : new Date(value);
  if (!base || Number.isNaN(base.getTime())) return null;
  const d = new Date(base);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** True if bill date is after end of today (local) */
export function isFutureBillDate(billDate) {
  const endToday = endOfLocalDay(new Date());
  return billDate > endToday;
}

/** True if bill date is before start of today (local) */
export function isBackdatedBill(billDate) {
  const startToday = startOfLocalDay(new Date());
  return billDate < startToday;
}
