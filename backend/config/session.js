const session = require('express-session');

module.exports = session({
  name: 'brb.sid',
  secret: process.env.SESSION_SECRET || 'brb-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 8,
  },
});
