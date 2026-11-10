const express = require('express');
const paymentController = require('../controllers/paymentController');

const router = express.Router();

router.get('/overview', paymentController.getOverview);
router.post('/record', paymentController.record);
router.post('/:id/verify', paymentController.verify);
router.post('/:id/reject', paymentController.reject);

module.exports = router;
