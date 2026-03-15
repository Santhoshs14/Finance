/**
 * Financial Month Utility (Frontend mirror)
 * Cycle: 25th of previous month → 24th of current month
 */

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Get the financial month range for a display label month+year
 * @param {number} month - 1-12 (label month, e.g. 3 = "March 2026")
 * @param {number} year
 * @returns {{ startDate: string, endDate: string, label: string, month: number, year: number }}
 */
export const getFinancialMonthRange = (month, year) => {
  const startMonth = month === 1 ? 12 : month - 1;
  const startYear  = month === 1 ? year - 1 : year;
  const startDate  = `${startYear}-${String(startMonth).padStart(2, '0')}-25`;
  const endDate    = `${year}-${String(month).padStart(2, '0')}-24`;
  const label      = `${MONTH_NAMES[month]} ${year}`;
  return { startDate, endDate, label, month, year };
};

/**
 * Get the current active financial month
 */
export const getCurrentFinancialMonth = (now = new Date()) => {
  const day   = now.getDate();
  const month = now.getMonth() + 1;
  const year  = now.getFullYear();

  if (day >= 25) {
    const labelMonth = month === 12 ? 1 : month + 1;
    const labelYear  = month === 12 ? year + 1 : year;
    return getFinancialMonthRange(labelMonth, labelYear);
  } else {
    return getFinancialMonthRange(month, year);
  }
};

/**
 * Get the last N financial month ranges (most recent first)
 */
export const getRecentFinancialMonths = (count = 6, now = new Date()) => {
  const current = getCurrentFinancialMonth(now);
  const months = [current];

  for (let i = 1; i < count; i++) {
    let { month, year } = months[months.length - 1];
    month -= 1;
    if (month === 0) { month = 12; year -= 1; }
    months.push(getFinancialMonthRange(month, year));
  }

  return months;
};

/**
 * Format a date string as dd MMM (e.g. "24 Mar")
 */
export const formatShortDate = (dateStr) => {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

/**
 * Gets the financial month label (e.g., 'Mar') for a specific date string ('YYYY-MM-DD').
 * Respects the 25th-to-24th cycle logic.
 */
export const getShortFinancialMonthLabelForDate = (dateStr) => {
  if (!dateStr) return '';
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  if (!yearStr || !monthStr || !dayStr) return '';
  
  const day = parseInt(dayStr, 10);
  let month = parseInt(monthStr, 10);

  if (day >= 25) {
    month = month === 12 ? 1 : month + 1;
  }
  
  // Return the first three letters of the month name
  return MONTH_NAMES[month].substring(0, 3);
};
