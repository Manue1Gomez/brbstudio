const express = require('express');
const calendarController = require('../controllers/calendarController');

const router = express.Router();

router.get('/blocked-dates', calendarController.getBlockedDatesInMonth);
router.get('/day', calendarController.getPublicDayAvailability);

module.exports = router;
