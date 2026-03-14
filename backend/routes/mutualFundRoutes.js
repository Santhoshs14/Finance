const express = require('express');
const router = express.Router();
const mutualFundController = require('../controllers/mutualFundController');
const authMiddleware = require('../middlewares/authMiddleware');
const validate = require('../middlewares/validate');
const { mutualFundValidator, sipValidator } = require('../validators/mutualFundValidator');

router.use(authMiddleware);

// Mutual Funds
router.get('/', mutualFundController.getAllFunds);
router.post('/', validate(mutualFundValidator), mutualFundController.createFund);

// SIP Plans
router.get('/sip', mutualFundController.getAllSIPs);
router.post('/sip', validate(sipValidator), mutualFundController.createSIP);

module.exports = router;
