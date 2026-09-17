const fs = require('fs');
const path = require('path');

const files = [
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

  // Fix any remaining isDirect references
  content = content.replace(/data-direct="\$\{isDirect \? '1' : '0'\}"/g, 'data-direct="0"');
  content = content.replace(/const isDirect = btn\.dataset\.action === 'buy-direct' \|\| card\.dataset\.direct === '1';\s*/g, '');
  content = content.replace(/direct_purchase:\s*isDirect/g, 'direct_purchase: false');

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Cleaned isDirect in:', file);
});
