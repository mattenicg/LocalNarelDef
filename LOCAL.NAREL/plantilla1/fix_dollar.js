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

  // Fix escaped $
  content = content.replace(/\\\$\\\{\(pricing\.hasCashDiscount/g, '${(pricing.hasCashDiscount');
  content = content.replace(/\\\$\{\(pricing\.hasCashDiscount/g, '${(pricing.hasCashDiscount');
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Fixed $ in:', file);
});
