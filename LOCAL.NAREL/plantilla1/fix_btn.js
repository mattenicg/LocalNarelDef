const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'plantilla 1.html');
if (fs.existsSync(filePath)) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Regex to remove the if (isDirect) { ... } return; } block
  const pattern = /const isDirect = !!\(currentModalProduct\.direct_purchase === true \|\| currentModalProduct\.direct_purchase === 1 \|\| currentModalProduct\.direct_purchase === 'true'\);\n\s*if \(isDirect\) \{\s*closeProductModal\(\);\s*if \(window\.shop && typeof window\.shop\.startDirectCheckout === 'function'\) \{\s*window\.shop\.startDirectCheckout\(\{[\s\S]*?\}\);\s*\}\s*return;\s*\}/g;
  
  content = content.replace(pattern, '');
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Fixed pmMainAddBtn in plantilla 1.html');
} else {
  console.log('Not found');
}
