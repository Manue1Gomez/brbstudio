const express = require('express');
const customerBookingController = require('../controllers/customerBookingController');
const requireCustomer = require('../middleware/requireCustomer');

const router = express.Router();

router.get('/availability', requireCustomer, customerBookingController.availability);
router.post('/', requireCustomer, customerBookingController.create);
router.post('/validate-voucher', requireCustomer, customerBookingController.validateVoucher);

module.exports = router;
