const creditCardModel = require('../models/creditCardModel');

const getAllCards = async (userId) => await creditCardModel.getAllCards(userId);
const createCard = async (userId, data) => await creditCardModel.createCard(userId, data);
const getAllTransactions = async (userId, creditCardId) => await creditCardModel.getAllTransactions(userId, creditCardId);
const createTransaction = async (userId, data) => await creditCardModel.createTransaction(userId, data);

module.exports = { getAllCards, createCard, getAllTransactions, createTransaction };
