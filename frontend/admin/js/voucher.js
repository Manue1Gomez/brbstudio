function createCard(voucher) {
  const card = elements.cardTemplate.content.firstElementChild.cloneNode(true);
  const tag = card.querySelector('.voucher-card__tag');
  const usageLimit = toCount(voucher.usageLimit);
  const usedCount = toCount(voucher.usedCount);
  const remainingUses = getRemainingUses(voucher);
  const usedPercent = usageLimit > 0 ? Math.min(100, (usedCount / usageLimit) * 100) : 0;
  const meter = card.querySelector('.voucher-card__meter');

  card.dataset.id = voucher.id;
  card.classList.toggle('voucher-card--expired', voucher.expired);
  card.classList.toggle('voucher-card--exhausted', !voucher.expired && remainingUses === 0);

  card.querySelector('.voucher-card__code').textContent = voucher.code;
  card.querySelector('.voucher-card__value').textContent = formatDiscount(voucher);
  card.querySelector('.voucher-card__name').textContent = voucher.name;
  card.querySelector('.voucher-card__period').textContent =
    `${formatDate(voucher.startDate)} \u2013 ${formatDate(voucher.endDate)}`;
  card.querySelector('.voucher-card__remaining').textContent = `${remainingUses} / ${usageLimit}`;
  card.querySelector('.voucher-card__usage-note').textContent =
    `${usedCount} of ${usageLimit} ${usageLimit === 1 ? 'use' : 'uses'} redeemed`;
  meter.setAttribute('aria-valuenow', String(Math.min(usageLimit, usedCount)));
  meter.setAttribute('aria-valuemax', String(usageLimit));
  meter.setAttribute('aria-valuetext', `${usedCount} of ${usageLimit} redemptions used`);
  card.querySelector('.voucher-card__meter-fill').style.width = `${usedPercent}%`;

  tag.textContent = voucher.expired ? 'Expired' : remainingUses === 0 ? 'Fully redeemed' : 'Active';
  tag.classList.toggle('tag--overdue', voucher.expired);
  tag.classList.toggle('voucher-card__tag--exhausted', !voucher.expired && remainingUses === 0);

  card.querySelector('[data-action="edit"]').setAttribute('aria-label', `Edit ${voucher.code}`);
  card.querySelector('[data-action="remove"]').setAttribute('aria-label', `Remove ${voucher.code}`);

  return card;
}

function updateDiscountPrefix() {
  elements.discountPrefix.textContent = elements.voucherForm.elements.discountType.value === 'Percentage' ? '%' : '\u20B1';
}


function openVoucherDialog(voucher = null) {
  const { elements: fields } = elements.voucherForm;

  editingVoucher = voucher;

  elements.voucherForm.reset();
  clearFormErrors(elements.voucherForm);

  elements.voucherDialogTitle.textContent = voucher ? 'Edit Voucher' : 'New Voucher';
  fields.code.value = voucher?.code ?? '';
  fields.name.value = voucher?.name ?? '';
  fields.discountType.value = voucher?.discountType ?? 'Percentage';
  fields.discountValue.value = voucher?.discountValue ?? '';
  fields.startDate.value = voucher?.startDate ?? '';
  fields.endDate.value = voucher?.endDate ?? '';
  fields.usageLimit.value = voucher?.usageLimit ?? '';
  updateDiscountPrefix();

  elements.voucherDialog.showModal();
  fields.code.focus();
}

async function handleVoucherSubmit(event) {
  event.preventDefault();
  clearFormErrors(elements.voucherForm);
  elements.voucherSubmit.disabled = true;

  try {
    const payload = Object.fromEntries(new FormData(elements.voucherForm));
    const saved = editingVoucher
      ? await sendJson(`${API_BASE}/${editingVoucher.id}`, 'PUT', payload)
      : await sendJson(API_BASE, 'POST', payload);

    if (editingVoucher) {
      vouchers[vouchers.findIndex((voucher) => voucher.id === saved.id)] = saved;
    } else {
      vouchers.push(saved);
    }

    renderVouchers();
    elements.voucherDialog.close();
    showToast(editingVoucher ? `${saved.code} was updated.` : `${saved.code} was added.`);
  } catch (error) {
    showFormError(elements.voucherForm, error);
  } finally {
    elements.voucherSubmit.disabled = false;
  }
}

elements.addButton.addEventListener('click', () => openVoucherDialog());
elements.searchInput.addEventListener('input', renderVouchers);

elements.grid.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;

  const voucher = findVoucher(button.closest('.voucher-card').dataset.id);

  if (button.dataset.action === 'edit') openVoucherDialog(voucher);
  if (button.dataset.action === 'remove') openDeleteDialog(voucher);
});

elements.voucherForm.addEventListener('submit', handleVoucherSubmit);
elements.voucherForm.elements.discountType.addEventListener('change', updateDiscountPrefix);
elements.confirmDelete.addEventListener('click', handleConfirmDelete);

clearFieldOnInput(elements.voucherForm);
enableDialogDismiss();
loadVouchers();
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) loadVouchers();
});

async function handleVoucherSubmit(event) {
  event.preventDefault();
  clearFormErrors(elements.voucherForm);
  elements.voucherSubmit.disabled = true;

  try {
    const payload = Object.fromEntries(new FormData(elements.voucherForm));
    const saved = editingVoucher
      ? await sendJson(`${API_BASE}/${editingVoucher.id}`, 'PUT', payload)
      : await sendJson(API_BASE, 'POST', payload);

    if (editingVoucher) {
      vouchers[vouchers.findIndex((voucher) => voucher.id === saved.id)] = saved;
    } else {
      vouchers.push(saved);
    }

    renderVouchers();
    elements.voucherDialog.close();
    showToast(editingVoucher ? `${saved.code} was updated.` : `${saved.code} was added.`);
  } catch (error) {
    showFormError(elements.voucherForm, error);
  } finally {
    elements.voucherSubmit.disabled = false;
  }
}

function openDeleteDialog(voucher) {
  voucherToDelete = voucher;

  elements.deleteMessage.textContent =
    `"${voucher.code}" will be permanently removed. Bookings that already used it keep their discount, ` +
    'but customers will no longer be able to enter this code.';
  elements.deleteError.hidden = true;
  elements.confirmDelete.disabled = false;

  elements.deleteDialog.showModal();
}

elements.addButton.addEventListener('click', () => openVoucherDialog());
elements.searchInput.addEventListener('input', renderVouchers);

elements.grid.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;

  const voucher = findVoucher(button.closest('.voucher-card').dataset.id);

  if (button.dataset.action === 'edit') openVoucherDialog(voucher);
  if (button.dataset.action === 'remove') openDeleteDialog(voucher);
});

elements.voucherForm.addEventListener('submit', handleVoucherSubmit);
elements.voucherForm.elements.discountType.addEventListener('change', updateDiscountPrefix);
elements.confirmDelete.addEventListener('click', handleConfirmDelete);

clearFieldOnInput(elements.voucherForm);
enableDialogDismiss();
loadVouchers();
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) loadVouchers();
});
