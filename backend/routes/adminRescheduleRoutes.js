const express = require('express');
const rescheduleController = require('../controllers/rescheduleController');

const router = express.Router();

router.get('/', rescheduleController.list);
router.post('/:id/approve', rescheduleController.approve);
router.post('/:id/reject', rescheduleController.reject);

module.exports = router;
