const lendingService = require('../services/lendingService');
const { success } = require('../utils/apiResponse');

const getAll = async (req, res, next) => {
  try {
    const records = await lendingService.getAllRecords(req.user.id);
    return success(res, records, 'Lending records retrieved');
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const record = await lendingService.createRecord(req.user.id, req.body);
    return success(res, record, 'Lending record created', 201);
  } catch (err) { next(err); }
};

const repay = async (req, res, next) => {
  try {
    const { amount } = req.body;
    const record = await lendingService.recordRepayment(req.user.id, req.params.id, amount);
    return success(res, record, 'Repayment recorded successfully');
  } catch (err) { next(err); }
};

module.exports = { getAll, create, repay };
