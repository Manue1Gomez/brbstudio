class AppError extends Error {
  constructor(message, status, fieldErrors = {}) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

module.exports = AppError;
