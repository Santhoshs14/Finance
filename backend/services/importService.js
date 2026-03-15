const XLSX = require('xlsx');
const { CATEGORIES } = require('../validators/transactionValidator');
const transactionModel = require('../models/transactionModel');

/**
 * Robustly parses various Excel date formats (Strings, native Dates, Serial Numbers)
 */
const parseExcelDate = (val) => {
  if (!val) return new Date().toISOString().split('T')[0];
  
  // 1. If it's already a JS Date
  if (val instanceof Date) {
    return val.toISOString().split('T')[0];
  }

  // 2. If it's an Excel Serial Number (e.g., 44927 for Jan 1, 2023)
  if (typeof val === 'number') {
    // Excel epochs: 25569 days between Dec 30, 1899 (Excel epoch) and Jan 1, 1970 (UNIX epoch)
    const excelEpoch = new Date(1899, 11, 30);
    const resultDate = new Date(excelEpoch.getTime() + val * 86400000);
    return resultDate.toISOString().split('T')[0];
  }

  // 3. Fallback for Strings (e.g., "12/05/2026", "2026-05-12")
  try {
    const d = new Date(String(val));
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  } catch (e) {
    console.warn('Failed to parse date:', val);
  }

  return new Date().toISOString().split('T')[0]; // Safe fallback to today
};

/**
 * Parse Excel file and return structured data
 */
const parseExcel = (buffer) => {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json(sheet);

  return rawData.map((row) => {
    const date = row['Date'] || row['date'];
    const amount = parseFloat(row['Amount (INR)'] || row['Amount'] || row['amount'] || 0);
    const paymentType = row['Payment Type'] || row['payment_type'] || '';
    const category = row['Category'] || row['category'] || 'Other';
    const notes = row['Notes'] || row['notes'] || '';

    // Auto-categorize if category is not in our list
    const normalizedCategory = CATEGORIES.includes(category) ? category : autoCategorize(notes, category);

    // Enforce Negative for Expenses, Positive for Income
    let finalAmount = Math.abs(amount); // start with absolute value
    if (normalizedCategory !== 'Income') {
      finalAmount = -finalAmount;
    }

    return {
      date: parseExcelDate(date),
      amount: finalAmount,
      payment_type: paymentType,
      category: normalizedCategory,
      notes,
    };
  });
};

/**
 * Simple auto-categorization based on keywords
 */
const autoCategorize = (notes, originalCategory) => {
  const text = `${notes} ${originalCategory}`.toLowerCase();

  const categoryKeywords = {
    Food: ['food', 'restaurant', 'zomato', 'swiggy', 'eat', 'lunch', 'dinner', 'breakfast', 'coffee', 'tea'],
    Travel: ['travel', 'uber', 'ola', 'cab', 'bus', 'train', 'flight', 'hotel'],
    Petrol: ['petrol', 'fuel', 'gas', 'diesel'],
    Shopping: ['amazon', 'flipkart', 'shopping', 'myntra', 'clothes', 'shoes'],
    Bills: ['bill', 'electricity', 'water', 'gas bill', 'phone', 'recharge'],
    Utilities: ['utility', 'internet', 'wifi', 'broadband'],
    Subscription: ['subscription', 'netflix', 'spotify', 'youtube', 'premium'],
    Entertainment: ['movie', 'entertainment', 'game', 'concert', 'show'],
    Rent: ['rent', 'lease', 'housing'],
    Home: ['home', 'furniture', 'repair', 'maintenance'],
    Investment: ['invest', 'stock', 'mutual fund', 'sip', 'fd'],
    Lending: ['lend', 'borrow', 'loan'],
    Gifts: ['gift', 'present', 'donation'],
    Income: ['salary', 'income', 'credit', 'refund', 'cashback'],
  };

  for (const [cat, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some((kw) => text.includes(kw))) {
      return cat;
    }
  }
  return 'Other';
};

/**
 * Detect duplicate transactions
 */
const detectDuplicates = async (userId, parsedData) => {
  const allTransactions = await transactionModel.getAll(userId);

  return parsedData.map((item) => {
    const isDuplicate = allTransactions.some((existing) =>
      existing.date === item.date &&
      Math.abs(existing.amount) === Math.abs(item.amount) &&
      (existing.category === item.category || existing.notes === item.notes)
    );
    return { ...item, is_duplicate: isDuplicate };
  });
};

/**
 * Import transactions (non-duplicates only)
 */
const importTransactions = async (userId, transactions, account_id) => {
  const toImport = transactions.filter((t) => !t.is_duplicate);
  if (toImport.length === 0) return { imported: 0, skipped: transactions.length };

  const cleaned = toImport.map(({ is_duplicate, ...rest }) => ({
    ...rest,
    account_id: account_id || 'imported',
  }));
  
  await transactionModel.createBatch(userId, cleaned);

  return {
    imported: toImport.length,
    skipped: transactions.length - toImport.length,
  };
};

module.exports = { parseExcel, detectDuplicates, importTransactions };
