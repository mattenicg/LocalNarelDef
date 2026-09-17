const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'plantilla 1.html');
if (fs.existsSync(filePath)) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace direct badge logic
  content = content.replace(/const isDirect = !!\(p\.direct_purchase === true \|\| p\.direct_purchase === 1 \|\| p\.direct_purchase === 'true'\);\n\s*const badge = isDirect \? '⚡ COMPRA DIRECTA' : \(CAT_LABEL\[cat\] \|\| 'NUEVO'\);\n\s*const badgeStyle = isDirect \? ' style="background:#fff;color:#000;font-weight:700;letter-spacing:0\.06em;"' : '';/g, 
    "const badge = CAT_LABEL[cat] || 'NUEVO';\n        const badgeStyle = '';");

  // Fix direct attrs
  content = content.replace(/data-direct="\$\{isDirect \? '1' : '0'\}"/g, 'data-direct="0"');
  
  // Replace button HTML
  content = content.replace(/const buttonHTML = isDirect\s*\?\s*`[\s\S]*?`\s*:\s*`[\s\S]*?`;/g, 
  `const buttonHTML = \`<button type="button" class="btn-add"\${disabledBtn} data-action="add" aria-label="Agregar \${name} al carrito" style="width:100%;background:#232733;color:#fff;border:1px solid #3d4354;border-radius:20px;padding:10px 16px;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px;transition:all .2s ease;">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0"/></svg>
              <span>\${stock <= 0 ? 'SIN STOCK' : 'AGREGAR'}</span>
            </button>\`;`);

  // Fix modal direct logic
  content = content.replace(/const recs = isDirect \? \[\] : getCrossSellProducts/g, 'const recs = getCrossSellProducts');
  content = content.replace(/const directNoticeHTML = isDirect \? `[\s\S]*?` : '';/g, "const directNoticeHTML = '';");
  
  // Modal buttons
  content = content.replace(/const mainBtnIcon = isDirect\s*\?\s*`[\s\S]*?`\s*:\s*`[\s\S]*?`;/g, 
    "const mainBtnIcon = `<svg viewBox=\"0 0 24 24\" width=\"18\" height=\"18\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0\"/></svg>`;");
  
  content = content.replace(/const mainBtnText = stock <= 0 \? 'SIN STOCK' : \(isDirect \? 'COMPRAR AHORA' : 'AGREGAR AL CARRITO'\);/g, 
    "const mainBtnText = stock <= 0 ? 'SIN STOCK' : 'AGREGAR AL CARRITO';");
    
  content = content.replace(/const mainBtnStyle = isDirect \? ' style="background:#fff;color:#000;font-weight:700;"' : '';/g, 
    "const mainBtnStyle = '';");

  content = content.replace(/const isDirect = !!\(currentModalProduct\.direct_purchase === true \|\| currentModalProduct\.direct_purchase === 1 \|\| currentModalProduct\.direct_purchase === 'true'\);\n\s*if \(isDirect\) \{\s*try \{\s*window\.shop\.addToCart\(\{\s*\.\.\.currentModalProduct,\s*direct_purchase: true\s*\}\);\s*\} catch \(err\) \{\}\s*window\.location\.href = '\/carrito\.html\?direct=1';\s*\} else \{/g, "");
  
  // Clean up the closing brace for the else statement if it exists
  // We'll just run a simpler replace that matches exactly the old block
  
  content = content.replace(/const isDirect = btn\.dataset\.action === 'buy-direct' \|\| card\.dataset\.direct === '1';\s*/g, '');
  content = content.replace(/direct_purchase:\s*isDirect/g, 'direct_purchase: false');
  content = content.replace(/if \(isDirect\) \{\s*if \(window\.shop\) \{\s*window\.shop\.addToCart\(\{ \.\.\.item, direct_purchase: true \}\);\s*\}\s*window\.location\.href = '\/carrito\.html\?direct=1';\s*\} else \{/g, '');

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Cleaned plantilla 1.html');
} else {
  console.log('Not found');
}
