const express = require('express');
const rescheduleController = require('../controllers/rescheduleController');

const router = express.Router();

router.get('/', rescheduleController.list);

module.exports = router;
