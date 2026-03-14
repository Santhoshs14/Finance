const lendingModel = require('../models/lendingModel');

const getAllRecords = async (userId) => await lendingModel.getAll(userId);
const createRecord = async (userId, data) => await lendingModel.create(userId, data);

const recordRepayment = async (userId, id, amount) => {
  // Fetch existing record
  const records = await lendingModel.getAll(userId);
  const record = records.find(r => r.id === id);
  if (!record) throw Object.assign(new Error('Record not found'), { statusCode: 404 });
  
  const newPaidAmount = (record.paid_amount || 0) + parseFloat(amount);
  let newStatus = record.status;
  
  if (newPaidAmount >= record.amount) {
    newStatus = 'settled';
  } else if (newPaidAmount > 0) {
    newStatus = 'partial';
  }
  
  return await lendingModel.update(userId, id, {
    paid_amount: newPaidAmount,
    status: newStatus,
    updated_at: new Date().toISOString()
  });
};

module.exports = { getAllRecords, createRecord, recordRepayment };
