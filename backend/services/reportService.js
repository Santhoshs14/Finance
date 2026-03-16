const { db } = require('../config/firebase');
const transactionModel = require('../models/transactionModel');
const PDFDocument = require('pdfkit');

/**
 * Get monthly report data
 */
const getMonthlyReport = async (userId, month, year) => {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

  const transactions = await transactionModel.getByDateRange(userId, startDate, endDate);

  // Category-wise breakdown
  const categoryBreakdown = {};
  let totalIncome = 0;
  let totalExpense = 0;

  transactions.forEach((txn) => {
    const amount = Math.abs(txn.amount);
    if (txn.category === 'Income' || txn.amount > 0) {
      totalIncome += amount;
    } else {
      totalExpense += amount;
    }

    if (!categoryBreakdown[txn.category]) {
      categoryBreakdown[txn.category] = { count: 0, total: 0 };
    }
    categoryBreakdown[txn.category].count += 1;
    categoryBreakdown[txn.category].total += amount;
  });

  return {
    month,
    year,
    total_transactions: transactions.length,
    total_income: totalIncome,
    total_expense: totalExpense,
    net_savings: totalIncome - totalExpense,
    savings_rate: totalIncome > 0 ? parseFloat(((totalIncome - totalExpense) / totalIncome * 100).toFixed(2)) : 0,
    category_breakdown: categoryBreakdown,
    transactions,
  };
};

/**
 * Get yearly report data
 */
const getYearlyReport = async (userId, year) => {
  const startDate = `${year}-01-01`;
  const endDate = `${year + 1}-01-01`;

  const transactions = await transactionModel.getByDateRange(userId, startDate, endDate);

  const monthlyData = {};
  let totalIncome = 0;
  let totalExpense = 0;

  transactions.forEach((txn) => {
    const d = new Date(txn.date);
    const month = d.getMonth() + 1;
    const amount = Math.abs(txn.amount);

    if (!monthlyData[month]) {
      monthlyData[month] = { income: 0, expense: 0, count: 0 };
    }
    monthlyData[month].count += 1;

    if (txn.category === 'Income' || txn.amount > 0) {
      totalIncome += amount;
      monthlyData[month].income += amount;
    } else {
      totalExpense += amount;
      monthlyData[month].expense += amount;
    }
  });

  return {
    year,
    total_transactions: transactions.length,
    total_income: totalIncome,
    total_expense: totalExpense,
    net_savings: totalIncome - totalExpense,
    savings_rate: totalIncome > 0 ? parseFloat(((totalIncome - totalExpense) / totalIncome * 100).toFixed(2)) : 0,
    monthly_breakdown: monthlyData,
  };
};

/**
 * Generate PDF report
 */
const generatePDF = (reportData, type = 'monthly') => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const buffers = [];

    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // Header
    doc.fontSize(24).font('Helvetica-Bold').text('WealthFlow Report', { align: 'center' });
    doc.moveDown(0.5);

    if (type === 'monthly') {
      doc.fontSize(16).font('Helvetica').text(
        `Monthly Report — ${reportData.month}/${reportData.year}`,
        { align: 'center' }
      );
    } else {
      doc.fontSize(16).font('Helvetica').text(
        `Yearly Report — ${reportData.year}`,
        { align: 'center' }
      );
    }

    doc.moveDown(1);
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(1);

    // Summary
    doc.fontSize(14).font('Helvetica-Bold').text('Summary');
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica');
    doc.text(`Total Transactions: ${reportData.total_transactions}`);
    doc.text(`Total Income: ₹${reportData.total_income.toLocaleString('en-IN')}`);
    doc.text(`Total Expense: ₹${reportData.total_expense.toLocaleString('en-IN')}`);
    doc.text(`Net Savings: ₹${reportData.net_savings.toLocaleString('en-IN')}`);
    doc.text(`Savings Rate: ${reportData.savings_rate}%`);
    doc.moveDown(1);

    // Category breakdown for monthly
    if (type === 'monthly' && reportData.category_breakdown) {
      doc.fontSize(14).font('Helvetica-Bold').text('Category Breakdown');
      doc.moveDown(0.5);
      doc.fontSize(11).font('Helvetica');

      Object.entries(reportData.category_breakdown).forEach(([category, data]) => {
        doc.text(`${category}: ₹${data.total.toLocaleString('en-IN')} (${data.count} transactions)`);
      });
    }

    // Monthly breakdown for yearly
    if (type === 'yearly' && reportData.monthly_breakdown) {
      doc.fontSize(14).font('Helvetica-Bold').text('Monthly Breakdown');
      doc.moveDown(0.5);
      doc.fontSize(11).font('Helvetica');

      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      Object.entries(reportData.monthly_breakdown).forEach(([month, data]) => {
        doc.text(`${months[parseInt(month) - 1]}: Income ₹${data.income.toLocaleString('en-IN')} | Expense ₹${data.expense.toLocaleString('en-IN')} | ${data.count} transactions`);
      });
    }

    doc.moveDown(2);
    doc.fontSize(9).fillColor('gray').text(
      `Generated on ${new Date().toLocaleString('en-IN')}`,
      { align: 'center' }
    );

    doc.end();
  });
};

module.exports = { getMonthlyReport, getYearlyReport, generatePDF };
