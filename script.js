// 🔗 Google Apps Script web app URL
// Example: const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/XXXXX/exec';
const APPS_SCRIPT_URL = 'YOUR_WEB_APP_URL_HERE';

// Local state
const state = {
  products: [],
  cart: [] // [{ id, name, price, qty, maxQty }]
};

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('year').textContent = new Date().getFullYear();

  // Load products
  fetchProducts();

  // Filters
  document.getElementById('categoryFilter').addEventListener('change', renderProducts);
  document.getElementById('searchInput').addEventListener('input', renderProducts);

  // Form submit
  document.getElementById('orderForm').addEventListener('submit', submitOrder);
});

async function fetchProducts() {
  try {
    const res = await fetch(APPS_SCRIPT_URL + '?action=products', {
      method: 'GET',
      cache: 'no-cache'
    });
    const products = await res.json();

    if (!Array.isArray(products)) {
      console.error('Unexpected products response:', products);
      throw new Error('Invalid response from server');
    }

    state.products = products;
    buildCategoryFilter();
    renderProducts();
  } catch (err) {
    console.error(err);
    const emptyEl = document.getElementById('productsEmpty');
    emptyEl.hidden = false;
    emptyEl.textContent = 'Unable to load menu. Please refresh or try again later.';
  }
}

function buildCategoryFilter() {
  const select = document.getElementById('categoryFilter');
  // Clear all except "All"
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

    const imgSrc = p.image || '';

    card.innerHTML = `
      <img src="${imgSrc}" alt="${escapeHtml(p.name || '')}" class="product-image" />
      <h3>${escapeHtml(p.name || '')}</h3>
      <div class="product-meta">
        <span class="price">$${price.toFixed(2)}</span>
        <span class="qty">${isOut ? 'Out of stock' : `In stock: ${qty}`}</span>
      </div>
      <p class="desc">${escapeHtml(p.description || '')}</p>
      <button class="btn-secondary" data-id="${p.id}">${isOut ? 'Unavailable' : 'Add to Order'}</button>
    `;

    const button = card.querySelector('button');
    button.disabled = isOut;

    if (!isOut) {
      button.addEventListener('click', () => addToCart(p));
    }

    grid.appendChild(card);
  });
}

// Add item to cart with quantity check
function addToCart(product) {
  const maxQty = Number(product.quantity) || 0;
  if (maxQty <= 0) {
    return;
  }

  const existing = state.cart.find(item => item.id === product.id);

  if (existing) {
    if (existing.qty >= maxQty) {
      alert('You’ve reached the available stock for this item.');
      return;
    }
    existing.qty += 1;
  } else {
    state.cart.push({
      id: product.id,
      name: product.name,
      price: Number(product.price) || 0,
      qty: 1,
      maxQty
    });
  }

  renderCart();
}

function renderCart() {
  const container = document.getElementById('cartItems');
  container.innerHTML = '';

  if (!state.cart.length) {
    const msg = document.createElement('p');
    msg.className = 'order-note';
    msg.textContent = 'Your pickup list is empty. Add items from the menu.';
    container.appendChild(msg);
    document.getElementById('cartTotal').textContent = '0.00';
    return;
  }

  let total = 0;

  state.cart.forEach(item => {
    const lineTotal = item.price * item.qty;
    total += lineTotal;

    const row = document.createElement('div');
    row.className = 'cart-row';

    row.innerHTML = `
      <span>${escapeHtml(item.name)} 
        <span class="qty-controls">
          <button type="button" class="qty-btn" data-action="minus">-</button>
          <span>${item.qty}</span>
          <button type="button" class="qty-btn" data-action="plus">+</button>
        </span>
      </span>
      <span>$${lineTotal.toFixed(2)}</span>
    `;

    const minusBtn = row.querySelector('[data-action="minus"]');
    const plusBtn = row.querySelector('[data-action="plus"]');

    minusBtn.addEventListener('click', () => updateCartQty(item.id, item.qty - 1));
    plusBtn.addEventListener('click', () => updateCartQty(item.id, item.qty + 1));

    container.appendChild(row);
  });

  document.getElementById('cartTotal').textContent = total.toFixed(2);
}

function updateCartQty(id, newQty) {
  const item = state.cart.find(i => i.id === id);
  if (!item) return;

  if (newQty <= 0) {
    // Remove item
    state.cart = state.cart.filter(i => i.id !== id);
  } else if (newQty > item.maxQty) {
    alert('You’ve reached the available stock for this item.');
    newQty = item.maxQty;
    item.qty = newQty;
  } else {
    item.qty = newQty;
  }

  renderCart();
}

// Submit order -> POST to Apps Script
async function submitOrder(e) {
  e.preventDefault();

  const messageEl = document.getElementById('orderMessage');
  messageEl.textContent = '';
  messageEl.className = 'order-message';

  if (!state.cart.length) {
    messageEl.textContent = 'Add at least one item to your pickup order.';
    messageEl.classList.add('error');
    return;
  }

  const customer = document.getElementById('customerName').value.trim();
  const phone = document.getElementById('customerPhone').value.trim();
  const pickupWindow = document.getElementById('pickupWindow').value.trim();

  if (!customer || !phone || !pickupWindow) {
    messageEl.textContent = 'Please fill in all fields.';
    messageEl.classList.add('error');
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

  messageEl.textContent = 'Submitting your order...';
  messageEl.classList.remove('error', 'success');

  try {
    const res = await fetch(APPS_SCRIPT_URL + '?action=order', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data && data.success) {
      messageEl.textContent = `Order placed! Your pickup order ID is ${data.orderId}. Please bring a valid ID.`;
      messageEl.classList.add('success');

      // Reset cart and form
      state.cart = [];
      renderCart();
      e.target.reset();
    } else {
      messageEl.textContent = 'There was a problem placing your order. Please try again.';
      messageEl.classList.add('error');
    }
  } catch (err) {
    console.error(err);
    messageEl.textContent = 'Error submitting order. Please check your connection and try again.';
    messageEl.classList.add('error');
  }
}

// Basic HTML escaping for safety
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
