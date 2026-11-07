const AppError = require('../services/appError');

function sendError(error, res, next) {
  if (error instanceof AppError) {
    return res.status(error.status).json({ message: error.message, errors: error.fieldErrors });
  }

  return next(error);
}

module.exports = sendError;
