const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'plantilla 1.html');
if (fs.existsSync(filePath)) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Regex to remove the if (isDirect) { ... } block around line 8715
  const pattern = /if \(isDirect\) \{\s*\/\/ Si requiere talle[\s\S]*?if \(window\.shop && typeof window\.shop\.startDirectCheckout === 'function'\) \{\s*window\.shop\.startDirectCheckout\(item\);\s*\}\s*return;\s*\}/g;
  
  content = content.replace(pattern, '');
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Fixed mountAddToCart in plantilla 1.html');
} else {
  console.log('Not found');
}
