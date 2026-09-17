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
  content = content.replace(/const recs = isDirect \? \[\] : getCrossSellProducts/g, 'const recs = getCrossSellProducts');
  content = content.replace(/\(only if not direct purchase\)/g, '');
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Cleaned isDirect in:', file);
});
