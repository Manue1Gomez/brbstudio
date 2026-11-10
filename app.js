const path = require('path');
const express = require('express');
require('dotenv').config();

const { testConnection } = require('./backend/config/db');
const sessionMiddleware = require('./backend/config/session');
const { UPLOADS_ROOT } = require('./backend/config/upload');
const customerModel = require('./backend/models/customerModel');
const serviceModel = require('./backend/models/serviceModel');
const bookingModel = require('./backend/models/bookingModel');
const blockedDateModel = require('./backend/models/blockedDateModel');
const paymentModel = require('./backend/models/paymentModel');
const authRoutes = require('./backend/routes/authRoutes');
const dashboardRoutes = require('./backend/routes/dashboardRoutes');
const serviceRoutes = require('./backend/routes/serviceRoutes');
const adminServiceRoutes = require('./backend/routes/adminServiceRoutes');
const calendarRoutes = require('./backend/routes/calendarRoutes');
const adminCalendarRoutes = require('./backend/routes/adminCalendarRoutes');
const adminPaymentRoutes = require('./backend/routes/adminPaymentRoutes');
const adminBookingRoutes = require('./backend/routes/adminBookingRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(sessionMiddleware);
app.use(express.static(path.join(__dirname, 'frontend')));
app.use(
  '/uploads',
  express.static(UPLOADS_ROOT, {
    setHeaders: (res) => res.set('X-Content-Type-Options', 'nosniff'),
  })
);

app.get('/', (req, res) => res.redirect('/customer/html/home.html'));
app.get('/admin', (req, res) => res.redirect('/admin/html/dashboard.html'));

app.use('/api/auth', authRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/admin/dashboard', dashboardRoutes);
app.use('/api/admin/services', adminServiceRoutes);
app.use('/api/admin/calendar', adminCalendarRoutes);
app.use('/api/admin/payments', adminPaymentRoutes);
app.use('/api/admin/bookings', adminBookingRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({ message: 'Endpoint not found.' });
});

app.use((error, req, res, next) => {
  const isClientError = error.status >= 400 && error.status < 500;

  if (!isClientError) console.error(error);

  res.status(isClientError ? error.status : 500).json({
    message: isClientError ? 'Invalid request.' : 'Something went wrong. Please try again.',
  });
});

app.listen(PORT, async () => {
  console.log(`BRB Studios running at http://localhost:${PORT}`);

  try {
    await testConnection();
    console.log('Database connected');

    const problems = [
      ...(await customerModel.verifySchema()),
      ...(await serviceModel.verifySchema()),
      ...(await bookingModel.verifySchema()),
      ...(await blockedDateModel.verifySchema()),
      ...(await paymentModel.verifySchema()),
    ];
    problems.forEach((problem) => console.warn(`Database warning: ${problem}`));
  } catch (error) {
    console.error(`Database connection failed: ${error.message}`);
  }
});
