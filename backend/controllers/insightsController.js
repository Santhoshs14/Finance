const insightsService = require('../services/insightsService');
const { success } = require('../utils/apiResponse');

const getInsights = async (req, res, next) => {
  try {
    const insights = await insightsService.generateInsights(req.user.id);
    return success(res, insights, 'Insights generated');
  } catch (err) { next(err); }
};

module.exports = { getInsights };
