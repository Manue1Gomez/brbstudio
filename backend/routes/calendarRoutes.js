const express = require('express');
const calendarController = require('../controllers/calendarController');

const router = express.Router();

router.get('/blocked-dates', calendarController.getBlockedDatesInMonth);

module.exports = router;
