async function create(req, res, next) {
  try {
    res.status(201).json(await voucherService.createVoucher(req.body));
  } catch (error) {
    sendError(error, res, next);
  }
}

async function remove(req, res, next) {
  try {
    await voucherService.deleteVoucher(req.params.id);
    res.status(204).end();
  } catch (error) {
    sendError(error, res, next);
  }
}

module.exports = { list, create, update, remove };
