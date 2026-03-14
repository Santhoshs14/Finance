/**
 * Financial Month Utility
 * Cycle: 25th of previous month → 24th of current month
 * Example: "March 2026" = Feb 25, 2026 → Mar 24, 2026
 */

/**
 * Get the financial month range for a given display month+year
 * @param {number} month - Calendar month (1-12) of the label (e.g., 3 for "March 2026")
 * @param {number} year  - Calendar year of the label
 * @returns {{ startDate: string, endDate: string, label: string }}
 */
const getFinancialMonthRange = (month, year) => {
  // Start = 25th of PREVIOUS month
  const startMonth = month === 1 ? 12 : month - 1;
  const startYear  = month === 1 ? year - 1 : year;
  const startDate  = `${startYear}-${String(startMonth).padStart(2, '0')}-25`;

  // End = 24th of CURRENT month
  const endDate = `${year}-${String(month).padStart(2, '0')}-24`;

  const MONTH_NAMES = [
    '', 'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const label = `${MONTH_NAMES[month]} ${year}`;

  return { startDate, endDate, label, month, year };
};

/**
 * Get the current active financial month range
 * If today is ≥ 25th, the active cycle is (this month's 25th → next month's 24th)
 * → label is NEXT calendar month
 * If today is < 25th, the active cycle is (last month's 25th → this month's 24th)
 * → label is THIS calendar month
 */
const getCurrentFinancialMonth = (now = new Date()) => {
  const day   = now.getDate();
  const month = now.getMonth() + 1; // 1-12
  const year  = now.getFullYear();

  if (day >= 25) {
    // Active cycle started on the 25th of this month → label is next month
    const labelMonth = month === 12 ? 1 : month + 1;
    const labelYear  = month === 12 ? year + 1 : year;
    return getFinancialMonthRange(labelMonth, labelYear);
  } else {
    // Active cycle started on the 25th of LAST month → label is this month
    return getFinancialMonthRange(month, year);
  }
};

/**
 * Get the last N financial month ranges (most recent first)
 */
const getRecentFinancialMonths = (count = 6, now = new Date()) => {
  const current = getCurrentFinancialMonth(now);
  const months = [current];

  for (let i = 1; i < count; i++) {
    let { month, year } = months[months.length - 1];
    month -= 1;
    if (month === 0) { month = 12; year -= 1; }
    months.push(getFinancialMonthRange(month, year));
  }

  return months; // [newest, older, ...]
};

/**
 * Check if the given date is the start of a new budget cycle (25th)
 */
const isNewCycleDay = (date = new Date()) => date.getDate() === 25;

module.exports = {
  getFinancialMonthRange,
  getCurrentFinancialMonth,
  getRecentFinancialMonths,
  isNewCycleDay,
};
