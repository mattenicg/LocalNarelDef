const { createOrderWithStock, releaseOrderStock } = require('../src/services/order.service');

// Mock db module
jest.mock('../src/db/postgres', () => {
  const mockProducts = new Map();
  const mockSizeStock = new Map(); // key: `${productId}::${sizeName.toLowerCase()}`

  return {
    mockProducts,
    mockSizeStock,
    query: jest.fn(),
    withTransaction: jest.fn(async (callback) => {
      const client = {
        query: jest.fn(async (sql, params) => {
          const sqlLower = sql.toLowerCase().trim();

          // UPDATE product_size_stock (deduct)
          if (sqlLower.startsWith('update product_size_stock') && (sqlLower.includes('stock-$1') || sqlLower.includes('stock - $1') || sqlLower.includes('stock-'))) {
            const qty = Number(params[0]);
            const prodId = String(params[1]);
            const sizeName = String(params[2]);
            const key = `${prodId}::${sizeName.trim().toLowerCase()}`;
            const existing = mockSizeStock.get(key);
            if (existing) {
              existing.stock = Math.max(0, existing.stock - qty);
            }
            return { rows: [] };
          }

          // UPDATE product_size_stock (restore)
          if (sqlLower.startsWith('update product_size_stock') && (sqlLower.includes('stock+$1') || sqlLower.includes('stock + $1') || sqlLower.includes('stock+'))) {
            const qty = Number(params[0]);
            const prodId = String(params[1]);
            const sizeName = String(params[2]);
            const key = `${prodId}::${sizeName.trim().toLowerCase()}`;
            const existing = mockSizeStock.get(key);
            if (existing) {
              existing.stock += qty;
            }
            return { rows: [] };
          }

          // UPDATE products SET stock = ...
          if (sqlLower.startsWith('update products set stock')) {
            const prodId = String(params[0]);
            let sum = 0;
            let hasVariants = false;
            for (const [key, val] of mockSizeStock.entries()) {
              if (key.startsWith(`${prodId}::`)) {
                hasVariants = true;
                sum += val.stock;
              }
            }
            const prod = mockProducts.get(prodId);
            if (prod) {
              prod.stock = hasVariants ? sum : Math.max(0, prod.stock - (Number(params[1]) || 0));
            }
            return { rows: [] };
          }

          // UPDATE orders SET status = ...
          if (sqlLower.startsWith('update orders set status')) {
            return { rows: [] };
          }

          // SELECT ... FROM products WHERE id=$1 ... FOR UPDATE
          if (sqlLower.includes('from products') && sqlLower.includes('for update')) {
            const prodId = String(params[0]);
            const prod = mockProducts.get(prodId);
            return { rows: prod ? [prod] : [] };
          }

          // SELECT ... FROM product_size_stock WHERE product_id=$1 ... FOR UPDATE
          if (sqlLower.includes('from product_size_stock') && sqlLower.includes('for update')) {
            const [prodId, sizeName] = params;
            if (sizeName) {
              const key = `${prodId}::${String(sizeName).trim().toLowerCase()}`;
              const row = mockSizeStock.get(key);
              return { rows: row ? [row] : [] };
            }
            const rows = [];
            for (const [key, val] of mockSizeStock.entries()) {
              if (key.startsWith(`${prodId}::`)) {
                rows.push({ ...val });
              }
            }
            return { rows };
          }

          // SELECT stock FROM product_size_stock WHERE product_id=$1
          if (sqlLower.includes('from product_size_stock where product_id')) {
            const prodId = String(params[0]);
            const rows = [];
            for (const [key, val] of mockSizeStock.entries()) {
              if (key.startsWith(`${prodId}::`)) {
                rows.push({ ...val });
              }
            }
            return { rows };
          }

          // INSERT INTO orders
          if (sqlLower.includes('insert into orders')) {
            return { rows: [{ id: 'order-123', order_number: 'N-1001' }] };
          }

          // INSERT INTO order_items
          if (sqlLower.includes('insert into order_items')) {
            return { rows: [] };
          }

          // SELECT nextval('order_number_seq')
          if (sqlLower.includes('order_number_seq')) {
            return { rows: [{ n: '1001' }] };
          }

          // SELECT FROM orders WHERE id = $1 FOR UPDATE (for cancel)
          if (sqlLower.includes('from orders') && sqlLower.includes('for update')) {
            return {
              rows: [{
                id: params[0],
                order_number: 'NL-20260917-01001',
                status: 'pendiente',
                payment_status: 'pendiente',
              }],
            };
          }

          // SELECT FROM stock_movements
          if (sqlLower.includes('from stock_movements')) {
            return { rows: [] };
          }

          // SELECT FROM order_items WHERE order_id = $1
          if (sqlLower.includes('from order_items where order_id')) {
            return {
              rows: [
                { id: 'oi-1', product_id: 'p1', size: 'S', quantity: 2, unit_price: 25000, line_total: 50000 },
              ],
            };
          }

          return { rows: [] };
        }),
      };
      return callback(client);
    }),
  };
});

const { mockProducts, mockSizeStock } = require('../src/db/postgres');

describe('Order Service Variant Stock Management', () => {
  beforeEach(() => {
    mockProducts.clear();
    mockSizeStock.clear();

    // Setup product: T-shirt with S (3), M (5), L (2) -> total stock: 10
    mockProducts.set('p1', {
      id: 'p1',
      name: 'Remera Urban',
      price: 25000,
      stock: 10,
      sizes: 'S, M, L',
    });

    mockSizeStock.set('p1::s', { id: 's1', product_id: 'p1', size_name: 'S', stock: 3 });
    mockSizeStock.set('p1::m', { id: 's2', product_id: 'p1', size_name: 'M', stock: 5 });
    mockSizeStock.set('p1::l', { id: 's3', product_id: 'p1', size_name: 'L', stock: 2 });
  });

  it('rejects order when requested size quantity exceeds variant stock', async () => {
    const orderData = {
      customer: { name: 'Juan Perez', email: 'juan@example.com', phone: '123456' },
      items: [
        { product_id: 'p1', size: 'S', quantity: 4, unit_price: 25000 },
      ],
      shipping: { method: 'pickup', cost: 0 },
    };

    await expect(createOrderWithStock(orderData)).rejects.toThrow(/Stock insuficiente para talle "S"/);
  });

  it('successfully creates order and deducts variant stock and syncs total stock', async () => {
    const orderData = {
      customer: { name: 'Juan Perez', email: 'juan@example.com', phone: '123456' },
      items: [
        { product_id: 'p1', size: 'S', quantity: 2, unit_price: 25000 },
        { product_id: 'p1', size: 'M', quantity: 1, unit_price: 25000 },
      ],
      shipping: { method: 'pickup', cost: 0 },
    };

    const order = await createOrderWithStock(orderData);
    expect(order).toBeDefined();
    expect(order.id).toBe('order-123');

    // S should now have 3 - 2 = 1
    expect(mockSizeStock.get('p1::s').stock).toBe(1);
    // M should now have 5 - 1 = 4
    expect(mockSizeStock.get('p1::m').stock).toBe(4);
    // L remains 2
    expect(mockSizeStock.get('p1::l').stock).toBe(2);
    // Total product stock should be 1 + 4 + 2 = 7
    expect(mockProducts.get('p1').stock).toBe(7);
  });

  it('restores variant stock and total stock on order cancellation', async () => {
    // S was at 1, after restoring 2 units it should be 3
    mockSizeStock.get('p1::s').stock = 1;
    mockProducts.get('p1').stock = 8;

    await releaseOrderStock('order-123', 'fallido');

    expect(mockSizeStock.get('p1::s').stock).toBe(3);
    expect(mockProducts.get('p1').stock).toBe(10);
  });
});
