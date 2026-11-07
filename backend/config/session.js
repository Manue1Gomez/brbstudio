const session = require('express-session');

const EIGHT_HOURS = 1000 * 60 * 60 * 8;

module.exports = session({
  name: 'brb.sid',
  secret: process.env.SESSION_SECRET || 'brb-studios-dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: EIGHT_HOURS,
  },
});
