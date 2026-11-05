const express = require('express');
const serviceController = require('../controllers/serviceController');

const router = express.Router();

// Public: used by the customer side to show the services on offer.
router.get('/', serviceController.listAvailable);

module.exports = router;
