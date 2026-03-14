const creditCardService = require('../services/creditCardService');
const { success } = require('../utils/apiResponse');

const getAllCards = async (req, res, next) => {
  try {
    const cards = await creditCardService.getAllCards(req.user.id);
    return success(res, cards, 'Credit cards retrieved');
  } catch (err) { next(err); }
};

const createCard = async (req, res, next) => {
  try {
    const card = await creditCardService.createCard(req.user.id, req.body);
    return success(res, card, 'Credit card created', 201);
  } catch (err) { next(err); }
};

const getAllTransactions = async (req, res, next) => {
  try {
    const creditCardId = req.query.credit_card_id || null;
    const txns = await creditCardService.getAllTransactions(req.user.id, creditCardId);
    return success(res, txns, 'Credit card transactions retrieved');
  } catch (err) { next(err); }
};

const createTransaction = async (req, res, next) => {
  try {
    const txn = await creditCardService.createTransaction(req.user.id, req.body);
    return success(res, txn, 'Credit card transaction created', 201);
  } catch (err) { next(err); }
};

module.exports = { getAllCards, createCard, getAllTransactions, createTransaction };
