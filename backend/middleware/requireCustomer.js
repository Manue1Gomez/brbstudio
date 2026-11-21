function requireCustomer(req, res, next) {
  if (!req.session.customer) {
    return res.status(401).json({ message: 'Please log in to continue.' });
  }
  next();
}

module.exports = requireCustomer;
