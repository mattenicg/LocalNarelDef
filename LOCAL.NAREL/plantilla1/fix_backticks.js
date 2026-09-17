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

  // Fix escaped backticks
  content = content.replace(/\\`/g, '`');
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Fixed backticks in:', file);
});
