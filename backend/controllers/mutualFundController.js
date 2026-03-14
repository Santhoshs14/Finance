const mutualFundService = require('../services/mutualFundService');
const { success } = require('../utils/apiResponse');

const getAllFunds = async (req, res, next) => {
  try {
    const funds = await mutualFundService.getAllFunds(req.user.id);
    return success(res, funds, 'Mutual funds retrieved');
  } catch (err) { next(err); }
};

const createFund = async (req, res, next) => {
  try {
    const fund = await mutualFundService.createFund(req.user.id, req.body);
    return success(res, fund, 'Mutual fund created', 201);
  } catch (err) { next(err); }
};

const getAllSIPs = async (req, res, next) => {
  try {
    const sips = await mutualFundService.getAllSIPs(req.user.id);
    return success(res, sips, 'SIP plans retrieved');
  } catch (err) { next(err); }
};

const createSIP = async (req, res, next) => {
  try {
    const sip = await mutualFundService.createSIP(req.user.id, req.body);
    return success(res, sip, 'SIP plan created', 201);
  } catch (err) { next(err); }
};

module.exports = { getAllFunds, createFund, getAllSIPs, createSIP };
