const investmentService = require('../services/investmentService');
const { success } = require('../utils/apiResponse');

const getAll = async (req, res, next) => {
  try {
    const investments = await investmentService.getAllRecords(req.user.id);
    return success(res, investments, 'Investments retrieved');
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const investment = await investmentService.createRecord(req.user.id, req.body);
    return success(res, investment, 'Investment created', 201);
  } catch (err) { next(err); }
};

const sync = async (req, res, next) => {
  try {
    const updated = await investmentService.syncLivePrices(req.user.id);
    return success(res, updated, 'Live prices synced successfully');
  } catch (err) { next(err); }
};

module.exports = { getAll, create, sync };
