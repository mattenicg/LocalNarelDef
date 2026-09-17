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

  // 1. Update getProductPricing if it doesn't have cash logic
  if (!content.includes('cashDiscountPercent =')) {
    content = content.replace(
      /const transferText = htmlEscape\(p\.direct_transfer_text \|\| 'con Transferencia'\);([\s\S]*?)return \{/,
      `const transferText = htmlEscape(p.direct_transfer_text || 'con Transferencia');
        
        const cashDiscountPercent = (p.cash_discount_percent !== undefined && p.cash_discount_percent !== null && p.cash_discount_percent !== '')
          ? Number(p.cash_discount_percent)
          : 0;
        const hasCashDiscount = cashDiscountPercent > 0;
        const cashDiscountText = htmlEscape(p.cash_discount_text || 'en efectivo');
        let cashPrice = hasCashDiscount ? (basePrice * (1 - (cashDiscountPercent / 100))) : basePrice;
        if (p.cash_custom_price !== undefined && p.cash_custom_price !== null && p.cash_custom_price !== '' && Number(p.cash_custom_price) > 0) {
          cashPrice = Number(p.cash_custom_price);
        }
        const cashText = htmlEscape(p.cash_text || 'en Efectivo');

        return {`
    );

    content = content.replace(
      /transferPriceStr: fmtPriceAR\(transferPrice\),\s*transferText,/,
      `transferPriceStr: fmtPriceAR(transferPrice),
          transferText,
          cashDiscountPercent,
          hasCashDiscount,
          cashDiscountText,
          cashPrice,
          cashPriceStr: fmtPriceAR(cashPrice),
          cashText,`
    );
  }

  // 2. Update productCardHTML rendering
  // We need to find the direct-transfer-line in the card and replace it with cash then transfer.
  // First, remove existing direct-cash-line in remeras if present
  content = content.replace(/\(\(pricing\.hasCashDiscount \|\| pricing\.cashPrice < pricing\.basePrice\)\s*\?\s*`<div class="direct-cash-line"[\s\S]*?<\/div>`\s*:\s*''\)\s*\+\s*/g, '');

  content = content.replace(
    /`<div class="direct-transfer-line" style="font-size:14px;font-weight:700;color:#f43f5e;letter-spacing:\.01em;margin-top:1px;">\$\{pricing\.transferPriceStr\} \$\{pricing\.transferText\}<\/div>` \+/g,
    `((pricing.hasCashDiscount || pricing.cashPrice < pricing.basePrice) ? \\\`<div class="direct-cash-line" style="font-size:14px;font-weight:700;color:#f43f5e;letter-spacing:.01em;margin-top:1px;">\\\${pricing.cashPriceStr} \\\${pricing.cashText}</div>\\\` : '') +
          \\\`<div class="direct-transfer-line" style="font-size:14px;font-weight:700;color:#f43f5e;letter-spacing:.01em;margin-top:1px;">\\\${pricing.transferPriceStr} \\\${pricing.transferText}</div>\\\` +`
  );

  // 3. Update openProductModal rendering
  // First remove existing cashPriceStr div below if present (in remeras)
  content = content.replace(/\n\s*\$\{\(pricing\.hasCashDiscount \|\| pricing\.cashPrice < pricing\.basePrice\)\s*\?\s*`<div style="font-size:15px;font-weight:700;color:#10b981;letter-spacing:\.01em;margin-top:2px;">\$\{pricing\.cashPriceStr\} \$\{pricing\.cashText\}<\/div>`\s*:\s*''\}/g, '');

  content = content.replace(
    /<div style="font-size:15px;font-weight:700;color:#f43f5e;letter-spacing:\.01em;margin-top:2px;">\$\{pricing\.transferPriceStr\} \$\{pricing\.transferText\}<\/div>/g,
    `\\$\\{(pricing.hasCashDiscount || pricing.cashPrice < pricing.basePrice) ? \\\`<div style="font-size:15px;font-weight:700;color:#f43f5e;letter-spacing:.01em;margin-top:2px;">\\\${pricing.cashPriceStr} \\\${pricing.cashText}</div>\\\` : ''}
            <div style="font-size:15px;font-weight:700;color:#f43f5e;letter-spacing:.01em;margin-top:2px;">\\\${pricing.transferPriceStr} \\\${pricing.transferText}</div>`
  );

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Updated cash price display in:', file);
});
