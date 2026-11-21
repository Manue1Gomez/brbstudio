
const express = require('express');
const authController = require('../controllers/authController');

const router = express.Router();

router.post('/register', authController.register);
<<<<<<< HEAD
router.post('/login',    authController.login);
router.post('/logout',   authController.logout);
router.get('/me',        authController.getCurrentCustomer);

=======
>>>>>>> 70d365e65dc1c3cf6b3f2ee8997eab8c1d5d60c3

module.exports = router;
