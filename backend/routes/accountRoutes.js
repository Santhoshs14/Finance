const express = require('express');
const router = express.Router();
const accountController = require('../controllers/accountController');
const authMiddleware = require('../middlewares/authMiddleware');
const validate = require('../middlewares/validate');
const { accountValidator, accountUpdateValidator } = require('../validators/accountValidator');

router.use(authMiddleware);

router.get('/', accountController.getAll);
router.get('/:id', accountController.getById);
router.post('/', validate(accountValidator), accountController.create);
router.put('/:id', validate(accountUpdateValidator), accountController.update);
router.delete('/:id', accountController.remove);

module.exports = router;
