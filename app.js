const path = require('path');
const express = require('express');
require('dotenv').config();

const { testConnection } = require('./backend/config/db');
const dashboardRoutes = require('./backend/routes/dashboardRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend')));

app.get('/admin', (req, res) => res.redirect('/admin/html/dashboard.html'));

app.use('/api/admin/dashboard', dashboardRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({ message: 'Endpoint not found.' });
});

// eslint-disable-next-line no-unused-vars
app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ message: 'Something went wrong. Please try again.' });
});

app.listen(PORT, async () => {
  console.log(`BRB Studios running at http://localhost:${PORT}`);

  try {
    await testConnection();
    console.log('Database connected');
  } catch (error) {
    console.error(`Database connection failed: ${error.message}`);
  }
});
