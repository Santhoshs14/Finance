const mutualFundModel = require('../models/mutualFundModel');

const getAllFunds = async (userId) => await mutualFundModel.getAllFunds(userId);
const createFund = async (userId, data) => await mutualFundModel.createFund(userId, data);
const getAllSIPs = async (userId) => await mutualFundModel.getAllSIPs(userId);
const createSIP = async (userId, data) => await mutualFundModel.createSIP(userId, data);

module.exports = { getAllFunds, createFund, getAllSIPs, createSIP };
