const express = require('express');
const router = express.Router();
const goalController = require('../controllers/goalController');
const authMiddleware = require('../middlewares/authMiddleware');
const validate = require('../middlewares/validate');
const { goalValidator } = require('../validators/goalValidator');

router.use(authMiddleware);

router.get('/', goalController.getAll);
router.post('/', validate(goalValidator), goalController.create);

module.exports = router;
