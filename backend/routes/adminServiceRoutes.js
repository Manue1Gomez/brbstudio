const express = require('express');
const serviceController = require('../controllers/serviceController');
const { uploadSingleImage } = require('../config/upload');

const router = express.Router();

router.get('/', serviceController.listAll);
router.post('/', uploadSingleImage('image'), serviceController.create);
router.put('/:id', uploadSingleImage('image'), serviceController.update);
router.patch('/:id/availability', serviceController.setAvailability);
router.delete('/:id', serviceController.remove);

module.exports = router;
