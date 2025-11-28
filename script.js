// 🔗 Google Apps Script web app URL
// Example: const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/XXXXX/exec';
// Replace this with your real URL when ready:
const APPS_SCRIPT_URL = 'YOUR_WEB_APP_URL_HERE';

const state = {
  products: [],
  cart: []
};

let quickSelectEl, quickPriceEl, quickStockEl, quickQtyEl, quickSubtotalEl, quickAddBtnEl;

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('year').textContent = new Date().getFullYear();

  quickSelectEl = document.getElementById('quickProductSelect');
  quickPriceEl = document.getElementById('quickPrice');
  quickStockEl = document.getElementById('quickStock');
  quickQtyEl = document.getElementById('quickQty');
  quickSubtotalEl = document.getElementById('quickSubtotal');
  quickAddBtnEl = document.getElementById('quickAddBtn');

  document.getElementById('categoryFilter').addEventListener('change', renderProducts);
  document.getElementById('searchInput').addEventListener('input', renderProducts);

  document.getElementById('orderForm').addEventListener('submit', submitOrder);

  quickSelectEl.addEventListener('change', handleQuickProductChange);
  quickQtyEl.addEventListener('input', handleQuickQtyChange);
  quickAddBtnEl.addEventListener('click', handleQuickAdd);

  fetchProducts();
});

/* ========================
   Data / products
   ======================== */

async function fetchProducts() {
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.includes('YOUR_WEB_APP_URL_HERE')) {
    console.warn('No Apps Script URL set. Loading demo products.');
    loadDemoProducts();
    return;
  }

  try {
    const res = await fetch(APPS_SCRIPT_URL + '?action=products', {
      method: 'GET',
      cache: 'no-cache'
    });
    const data = await res.json();

    if (!Array.isArray(data)) {
      throw new Error('Unexpected response for products');
    }

    state.products = data;
    buildCategoryFilter();
    renderProducts();
    populateQuickOrderSelect();
  } catch (err) {
    console.error('Error fetching products, falling back to demo:', err);
    loadDemoProducts();
  }
}

function loadDemoProducts() {
  state.products = [
    {
      id: 'demo1',
      name: 'Blueberry Delta 8 Disposable',
      category: 'Vapes',
      price: 24.99,
      description: 'Smooth blueberry flavor disposable vape.',
      image: '',
      quantity: 20
    },
    {
      id: 'demo2',
      name: '12" Glass Water Pipe',
      category: 'Glass',
      price: 39.99,
      description: 'Clear glass water pipe with ice catcher.',
      image: '',
      quantity: 8
    },
    {
      id: 'demo3',
      name: 'Rolling Papers (King Size)',
      category: 'Papers',
      price: 2.99,
      description: 'Slow-burning king size papers.',
      image: '',
      quantity: 120
    }
  ];
  buildCategoryFilter();
  renderProducts();
  populateQuickOrderSelect();
}

function buildCategoryFilter() {
  const select = document.getElementById('categoryFilter');
  select.innerHTML = '<option value="">All</option>';

  const categories = [...new Set(state.products.map(p => p.category).filter(Boolean))].sort();
  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    select.appendChild(opt);
  });
}

function renderProducts() {
  const grid = document.getElementById('productsGrid');
  const emptyEl = document.getElementById('productsEmpty');

  grid.innerHTML = '';

  const selectedCat = document.getElementById('categoryFilter').value;
  const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();

  let items = [...state.products];

  if (selectedCat) {
    items = items.filter(p => p.category === selectedCat);
  }

  if (searchTerm) {
    items = items.filter(p => {
      const haystack = `${p.name || ''} ${p.description || ''} ${p.category || ''}`.toLowerCase();
      return haystack.includes(searchTerm);
    });
  }

  if (!items.length) {
    emptyEl.hidden = false;
    return;
  } else {
    emptyEl.hidden = true;
  }

  items.forEach(p => {
    const card = document.createElement('div');
    card.className = 'product-card';

    const price = Number(p.price) || 0;
    const qty = Number(p.quantity) || 0;
    const isOut = qty <= 0;

    card.innerHTML = `
      <img src="${p.image || ''}" alt="${escapeHtml(p.name || '')}" class="product-image" />
      <div class="product-info">
        <h3>${escapeHtml(p.name || '')}</h3>
        <div class="product-meta">
          <span class="price">$${price.toFixed(2)}</span>
          <span class="qty">${isOut ? 'Out of stock' : 'In stock: ' + qty}</span>
        </div>
        <p class="desc">${escapeHtml(p.description || '')}</p>
      </div>
    `;

    grid.appendChild(card);
  });
}

/* ========================
   Quick Order widget
   ======================== */

function populateQuickOrderSelect() {
  quickSelectEl.innerHTML = '';

  if (!state.products.length) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'No products available';
    quickSelectEl.appendChild(opt);
    quickSelectEl.disabled = true;
    quickAddBtnEl.disabled = true;
    quickPriceEl.textContent = '$0.00';
    quickStockEl.textContent = 'No products';
    quickSubtotalEl.textContent = '$0.00';
    return;
  }

  quickSelectEl.disabled = false;
  quickAddBtnEl.disabled = false;

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Select a product...';
  quickSelectEl.appendChild(placeholder);

  state.products.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    quickSelectEl.appendChild(opt);
  });
}

function handleQuickProductChange() {
  const id = quickSelectEl.value;
  const product = state.products.find(p => String(p.id) === String(id));

  if (!product) {
    quickPriceEl.textContent = '$0.00';
    quickStockEl.textContent = 'Select a product';
    quickSubtotalEl.textContent = '$0.00';
    quickQtyEl.value = 1;
    quickQtyEl.disabled = true;
    quickAddBtnEl.disabled = true;
    return;
  }

  const price = Number(product.price) || 0;
  const qty = Number(product.quantity) || 0;
  const isOut = qty <= 0;

  quickPriceEl.textContent = `$${price.toFixed(2)}`;
  quickStockEl.textContent = isOut ? 'Out of stock' : `In stock: ${qty}`;
  quickQtyEl.disabled = isOut;
  quickAddBtnEl.disabled = isOut;

  if (!isOut) {
    quickQtyEl.min = 1;
    quickQtyEl.max = qty;
    if (!quickQtyEl.value || Number(quickQtyEl.value) < 1) {
      quickQtyEl.value = 1;
    }
  } else {
    quickQtyEl.value = 0;
  }

  updateQuickSubtotal();
}

function handleQuickQtyChange() {
  const id = quickSelectEl.value;
  const product = state.products.find(p => String(p.id) === String(id));
  if (!product) return;

  const maxQty = Number(product.quantity) || 0;
  let qty = Number(quickQtyEl.value) || 0;

  if (qty < 1) qty = 1;
  if (qty > maxQty) qty = maxQty;

  quickQtyEl.value = qty;
  updateQuickSubtotal();
}

function updateQuickSubtotal() {
  const id = quickSelectEl.value;
  const product = state.products.find(p => String(p.id) === String(id));

  if (!product) {
    quickSubtotalEl.textContent = '$0.00';
    return;
  }

  const price = Number(product.price) || 0;
  const qty = Number(quickQtyEl.value) || 0;
  const subtotal = price * qty;
  quickSubtotalEl.textContent = `$${subtotal.toFixed(2)}`;
}

function handleQuickAdd() {
  const id = quickSelectEl.value;
  const product = state.products.find(p => String(p.id) === String(id));
  if (!product) return;

  const maxQty = Number(product.quantity) || 0;
  let qty = Number(quickQtyEl.value) || 0;
  if (qty < 1) qty = 1;
  if (qty > maxQty) qty = maxQty;

  addToCart(product, qty);
  updateQuickSubtotal(); // keep line total in sync
}

/* ========================
   Cart
   ======================== */

function addToCart(product, qtyToAdd) {
  const maxQty = Number(product.quantity) || 0;
  if (maxQty <= 0) return;

  const existing = state.cart.find(item => item.id === product.id);

  if (existing) {
    const newQty = Math.min(existing.qty + qtyToAdd, maxQty);
    existing.qty = newQty;
  } else {
    const qty = Math.min(qtyToAdd, maxQty);
    state.cart.push({
      id: product.id,
      name: product.name,
      price: Number(product.price) || 0,
      qty,
      maxQty
    });
  }

  renderCart();
}

function renderCart() {
  const container = document.getElementById('cartItems');
  container.innerHTML = '';

  if (!state.cart.length) {
    const p = document.createElement('p');
    p.className = 'small-note';
    p.textContent = 'Your pickup order is empty. Use Quick Order or the menu to add items.';
    container.appendChild(p);
    document.getElementById('cartTotal').textContent = '0.00';
    return;
  }

  let total = 0;

  state.cart.forEach(item => {
    const lineTotal = item.price * item.qty;
    total += lineTotal;

    const row = document.createElement('div');
    row.className = 'cart-row';

    const main = document.createElement('div');
    main.className = 'cart-row-main';

    const title = document.createElement('div');
    title.className = 'cart-row-title';
    title.textContent = item.name;

    const controls = document.createElement('div');
    controls.className = 'cart-row-controls';
    controls.innerHTML = `
      Qty:
      <button type="button" class="qty-btn" data-action="minus">-</button>
      <span>${item.qty}</span>
      <button type="button" class="qty-btn" data-action="plus">+</button>
      <button type="button" class="qty-btn" data-action="remove" title="Remove item">×</button>
    `;

    main.appendChild(title);
    main.appendChild(controls);

    const priceEl = document.createElement('div');
    priceEl.className = 'cart-row-price';
    priceEl.textContent = `$${lineTotal.toFixed(2)}`;

    row.appendChild(main);
    row.appendChild(priceEl);

    container.appendChild(row);

    const [minusBtn, , qtySpan, plusBtn, removeBtn] = controls.querySelectorAll('button, span');

    minusBtn.addEventListener('click', () => {
      updateCartQty(item.id, item.qty - 1);
    });
    plusBtn.addEventListener('click', () => {
      updateCartQty(item.id, item.qty + 1);
    });
    removeBtn.addEventListener('click', () => {
      removeCartItem(item.id);
    });
  });

  document.getElementById('cartTotal').textContent = total.toFixed(2);
}

function updateCartQty(id, newQty) {
  const item = state.cart.find(i => i.id === id);
  if (!item) return;

  if (newQty <= 0) {
    removeCartItem(id);
    return;
  }

  if (newQty > item.maxQty) {
    newQty = item.maxQty;
    alert('You have reached the available stock for this item.');
  }

  item.qty = newQty;
  renderCart();
}

function removeCartItem(id) {
  state.cart = state.cart.filter(i => i.id !== id);
  renderCart();
}

/* ========================
   Submit order
   ======================== */

async function submitOrder(e) {
  e.preventDefault();

  const msgEl = document.getElementById('orderMessage');
  msgEl.textContent = '';
  msgEl.className = 'order-message';

  if (!state.cart.length) {
    msgEl.textContent = 'Add at least one item to your pickup order.';
    msgEl.classList.add('error');
    return;
  }

  const customer = document.getElementById('customerName').value.trim();
  const phone = document.getElementById('customerPhone').value.trim();
  const pickupWindow = document.getElementById('pickupWindow').value.trim(); // datetime-local string

  if (!customer || !phone || !pickupWindow) {
    msgEl.textContent = 'Please fill in all pickup details.';
    msgEl.classList.add('error');
    return;
  }

  const total = Number(document.getElementById('cartTotal').textContent) || 0;

  const payload = {
    customer,
    phone,
    pickupWindow,
    items: state.cart.map(i => ({
      id: i.id,
      name: i.name,
      qty: i.qty,
      price: i.price
    })),
    total
  };

  // If you haven't wired the backend yet, simulate success
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.includes('YOUR_WEB_APP_URL_HERE')) {
    msgEl.textContent = 'Demo mode: calculator and form are working, but order was not sent.';
    msgEl.classList.add('success');
    return;
  }

  msgEl.textContent = 'Submitting your order...';

  try {
    const res = await fetch(APPS_SCRIPT_URL + '?action=order', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data && data.success) {
      msgEl.textContent = `Order placed! Your order ID is ${data.orderId}. Please bring valid ID at pickup.`;
      msgEl.classList.add('success');
      state.cart = [];
      renderCart();
      e.target.reset();
    } else {
      msgEl.textContent = 'There was a problem placing your order. Please try again.';
      msgEl.classList.add('error');
    }
  } catch (err) {
    console.error(err);
    msgEl.textContent = 'Network error submitting order. Please try again.';
    msgEl.classList.add('error');
  }
}

/* ========================
   Helpers
   ======================== */

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
