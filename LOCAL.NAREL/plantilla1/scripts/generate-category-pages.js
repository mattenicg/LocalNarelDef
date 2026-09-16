const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const templatePath = path.join(rootDir, 'plantilla 1.html');
const templateHtml = fs.readFileSync(templatePath, 'utf8');

const categories = [
  { slug: 'pantalones', name: 'Pantalones' },
  { slug: 'camperas', name: 'Camperas' },
  { slug: 'buzos', name: 'Buzos' },
  { slug: 'remeras', name: 'Remeras' },
  { slug: 'accesorios', name: 'Accesorios' },
];

categories.forEach(cat => {
  let html = templateHtml;
  const pageTitle = `${cat.name.toUpperCase()} | NAREL LOCAL`;
  html = html.replace(/<title>.*?<\/title>/i, `<title>${pageTitle}</title>`);

  const categoryPageCss = `
  <style id="__category_page_css">
    body.is-category-page #inicio,
    body.is-category-page #shippingPromoBanner,
    body.is-category-page .categories,
    body.is-category-page #secciones-grid {
      display: none !important;
    }
    body.is-category-page .catalog-section:not(#${cat.slug}):not(#otros-servicios) {
      display: none !important;
    }
    body.is-category-page #${cat.slug},
    body.is-category-page #otros-servicios {
      display: block !important;
    }
    body.is-category-page #${cat.slug} .section-label {
      display: none !important;
    }
  </style>`;

  const routeState = JSON.stringify({
    category: cat.slug,
    categoryName: cat.name,
    subcategory: null,
    subcategoryName: null,
  });

  const injection = `
  ${categoryPageCss}
  <script id="__route_state_injected">window.__DYNAMIC_ROUTE__ = ${routeState};</script>`;

  if (html.includes('</head>')) {
    html = html.replace('</head>', `${injection}\n</head>`);
  } else {
    html = injection + html;
  }

  if (/<body[^>]*class=["']/i.test(html)) {
    html = html.replace(/<body([^>]*)class=["']([^"']*)["']/i, `<body$1class="$2 is-category-page is-cat-${cat.slug}" data-category="${cat.slug}"`);
  } else {
    html = html.replace(/<body([^>]*)>/i, `<body$1 class="is-category-page is-cat-${cat.slug}" data-category="${cat.slug}">`);
  }

  fs.writeFileSync(path.join(rootDir, `${cat.slug}.html`), html, 'utf8');
  if (fs.existsSync(path.join(rootDir, 'public'))) {
    fs.writeFileSync(path.join(rootDir, 'public', `${cat.slug}.html`), html, 'utf8');
  }
  console.log(`Generated ${cat.slug}.html`);
});
