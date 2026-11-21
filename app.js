const path = require('path');
const express = require('express');
require('dotenv').config();

const { testConnection } = require('./backend/config/db');
const dashboardRoutes = require('./backend/routes/dashboardRoutes');
const customerModel = require('./backend/models/customerModel');
const authRoutes = require('./backend/routes/authRoutes');


const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend')));

HEAD
app.get('/', (req, res) => res.redirect('/customer/html/register.html'));
app.get('/admin', (req, res) => res.redirect('/admin/html/dashboard.html'));

app.use('/api/auth', authRoutes);
app.use('/api/admin/dashboard', dashboardRoutes);

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
    const problems = await customerModel.verifySchema();
    problems.forEach((p) => console.warn(`Database warning: ${p}`));
  } catch (error) {
    console.error(`Database connection failed: ${error.message}`);
  }
});
