const express = require('express');
const calendarController = require('../controllers/calendarController');

const router = express.Router();

router.get('/month', calendarController.getMonthOverview);
router.get('/blocked-dates', calendarController.getBlockedDatesInMonth);
router.get('/availability', calendarController.getPublicDayAvailability);

module.exports = router;
