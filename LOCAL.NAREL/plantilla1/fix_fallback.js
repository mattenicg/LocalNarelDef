const fs = require('fs');
const path = require('path');

const files = [
  'plantilla 1.html',
  'public/remeras.html',
  'public/buzos.html',
  'public/camperas.html',
  'public/pantalones.html',
  'public/accesorios.html'
];

files.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Fix directAttrs
  content = content.replace(
    /const directAttrs = ` data-direct="0" data-allowed-methods="\$\{htmlEscape\(JSON\.stringify\(p\.allowed_payment_methods \|\| \[\]\)\)\}" data-allowed-installments="\$\{htmlEscape\(JSON\.stringify\(p\.allowed_installments \|\| \[\]\)\)\}" data-discount-percent="\$\{pricing\.discountPercent\}" data-discount-text="\$\{pricing\.discountText\}" data-custom-transfer="\$\{p\.direct_custom_transfer_price \|\| ''\}" data-installments-count="\$\{pricing\.installmentsCount\}" data-installments-text="\$\{pricing\.installmentsText\}"`;/g,
    `const directAttrs = \` data-direct="0" data-allowed-methods="\${htmlEscape(JSON.stringify(p.allowed_payment_methods || []))}" data-allowed-installments="\${htmlEscape(JSON.stringify(p.allowed_installments || []))}" data-discount-percent="\${pricing.discountPercent}" data-discount-text="\${pricing.discountText}" data-custom-transfer="\${p.direct_custom_transfer_price || ''}" data-cash-discount-percent="\${pricing.cashDiscountPercent}" data-cash-discount-text="\${pricing.cashDiscountText}" data-custom-cash="\${p.cash_custom_price || ''}" data-installments-count="\${pricing.installmentsCount}" data-installments-text="\${pricing.installmentsText}"\`;`
  );

  // 2. Fix mountAddToCart fallback
  content = content.replace(
    /direct_custom_transfer_price: card\.dataset\.customTransfer \? Number\(card\.dataset\.customTransfer\) : null,\s*direct_installments_count: Number\(card\.dataset\.installmentsCount \|\| 6\),\s*direct_installments_text: card\.dataset\.installmentsText \|\| 'sin interés',/g,
    `direct_custom_transfer_price: card.dataset.customTransfer ? Number(card.dataset.customTransfer) : null,
                cash_discount_percent: Number(card.dataset.cashDiscountPercent || 0),
                cash_discount_text: card.dataset.cashDiscountText || 'en efectivo',
                cash_custom_price: card.dataset.customCash ? Number(card.dataset.customCash) : null,
                direct_installments_count: Number(card.dataset.installmentsCount || 6),
                direct_installments_text: card.dataset.installmentsText || 'sin interés',`
  );

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Fixed fallback data in:', file);
});
