/**
 * Financial Month Utility (Frontend mirror)
 * Cycle: cycleStartDay of previous month → (cycleStartDay-1) of current month
 * Default cycleStartDay is 25 but can be customized per user.
 */

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Get the financial month range for a display label month+year
 * @param {number} month - 1-12 (label month, e.g. 3 = "March 2026")
 * @param {number} year
 * @param {number} startDay - Day of month when cycle starts (1-28, default 25)
 * @returns {{ startDate: string, endDate: string, label: string, month: number, year: number }}
 */
export const getFinancialMonthRange = (month, year, startDay = 25) => {
  const endDay    = startDay - 1;
  const startMonth = month === 1 ? 12 : month - 1;
  const startYear  = month === 1 ? year - 1 : year;
  const startDate  = `${startYear}-${String(startMonth).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;
  const endDate    = `${year}-${String(month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
  const label      = `${MONTH_NAMES[month]} ${year}`;
  return { startDate, endDate, label, month, year };
};

/**
 * Get the current active financial month
 * @param {Date} now
 * @param {number} startDay - Day of month cycle starts (default 25)
 */
export const getCurrentFinancialMonth = (now = new Date(), startDay = 25) => {
  const day   = now.getDate();
  const month = now.getMonth() + 1;
  const year  = now.getFullYear();

  if (day >= startDay) {
    const labelMonth = month === 12 ? 1 : month + 1;
    const labelYear  = month === 12 ? year + 1 : year;
    return getFinancialMonthRange(labelMonth, labelYear, startDay);
  } else {
    return getFinancialMonthRange(month, year, startDay);
  }
};

/**
 * Get the last N financial month ranges (most recent first)
 * @param {number} count
 * @param {Date} now
 * @param {number} startDay - Day of month cycle starts (default 25)
 */
export const getRecentFinancialMonths = (count = 6, now = new Date(), startDay = 25) => {
  const current = getCurrentFinancialMonth(now, startDay);
  const months = [current];

  for (let i = 1; i < count; i++) {
    let { month, year } = months[months.length - 1];
    month -= 1;
    if (month === 0) { month = 12; year -= 1; }
    months.push(getFinancialMonthRange(month, year, startDay));
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
 * Respects the configurable cycleStartDay logic.
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @param {number} startDay - Day of month cycle starts (default 25)
 */
export const getShortFinancialMonthLabelForDate = (dateStr, startDay = 25) => {
  if (!dateStr) return '';
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  if (!yearStr || !monthStr || !dayStr) return '';
  
  const day = parseInt(dayStr, 10);
  let month = parseInt(monthStr, 10);

  if (day >= startDay) {
    month = month === 12 ? 1 : month + 1;
  }
  
  // Return the first three letters of the month name
  return MONTH_NAMES[month].substring(0, 3);
};
