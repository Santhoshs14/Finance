const investmentModel = require('../models/investmentModel');
const yahooFinance = require('yahoo-finance2').default;

const getAllRecords = async (userId) => await investmentModel.getAll(userId);
const createRecord = async (userId, data) => await investmentModel.create(userId, data);

const syncLivePrices = async (userId) => {
  const investments = await investmentModel.getAll(userId);
  const updated = [];
  
  for (const inv of investments) {
    if (inv.symbol && inv.investment_type === 'stocks') {
      try {
        const quote = await yahooFinance.quote(inv.symbol);
        if (quote && quote.regularMarketPrice) {
          const updatedInv = await investmentModel.update(userId, inv.id, {
            ...inv,
            current_price: quote.regularMarketPrice,
            updated_at: new Date().toISOString()
          });
          updated.push(updatedInv);
        }
      } catch (e) {
        console.error(`Failed to fetch price for ${inv.symbol}:`, e.message);
      }
    }
  }
  return updated;
};

module.exports = { getAllRecords, createRecord, syncLivePrices };
