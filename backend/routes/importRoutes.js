const express = require('express');
const router = express.Router();
const multer = require('multer');
const importController = require('../controllers/importController');
const authMiddleware = require('../middlewares/authMiddleware');

// Store in memory for processing
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (allowedTypes.includes(file.mimetype) || file.originalname.endsWith('.xlsx') || file.originalname.endsWith('.xls')) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx, .xls) are allowed'));
    }
  },
});

router.use(authMiddleware);

router.post('/excel', upload.single('file'), importController.importExcel);

module.exports = router;
