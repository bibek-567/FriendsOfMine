const products = [
  { id: 't1', name: 'Cappuccino', category: 'Coffee', price: 380, image: 'https://images.unsplash.com/photo-1498804103079-a6351b050096?auto=format&fit=crop&w=900&q=80', description: 'Smooth espresso with velvety milk foam.' },
  { id: 't2', name: 'Mocha Latte', category: 'Coffee', price: 420, image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=900&q=80', description: 'A classic mocha with rich chocolate notes.' },
  { id: 't3', name: 'Avocado Toast', category: 'Breakfast', price: 460, image: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=900&q=80', description: 'Sourdough, smashed avocado, and chili flakes.' },
  { id: 't4', name: 'Burrito Bowl', category: 'Lunch', price: 560, image: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80', description: 'Rice bowl with grilled protein and fresh greens.' },
  { id: 't5', name: 'Cheese Burger', category: 'Fast Food', price: 520, image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80', description: 'Juicy grilled burger with melted cheddar.' },
  { id: 't6', name: 'Berry Cheesecake', category: 'Dessert', price: 350, image: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=900&q=80', description: 'Creamy cheesecake with mixed berry topping.' }
];

const cartKey = 'friends_of_mine_cart';

function getCart() {
  try {
    return JSON.parse(localStorage.getItem(cartKey) || '[]');
  } catch {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(cartKey, JSON.stringify(cart));
}

function addToCart(productId) {
  const cart = getCart();
  const existing = cart.find((item) => item.id === productId);

  if (existing) {
    existing.qty += 1;
  } else {
    const product = products.find((p) => p.id === productId);
    cart.push({ ...product, qty: 1 });
  }

  saveCart(cart);
  renderCart();
}

function changeQty(productId, delta) {
  const cart = getCart();
  const item = cart.find((p) => p.id === productId);
  if (!item) return;

  item.qty += delta;
  if (item.qty <= 0) {
    const filtered = cart.filter((p) => p.id !== productId);
    saveCart(filtered);
    renderCart();
    return;
  }

  saveCart(cart);
  renderCart();
}

function getCartTotal() {
  return getCart().reduce((sum, item) => sum + (Number(item.price) * Number(item.qty)), 0);
}

function renderCart() {
  const cart = getCart();
  const cartContainer = document.getElementById('cartItems');
  const subtotalEl = document.getElementById('cartTotal');

  if (!cartContainer || !subtotalEl) return;

  if (!cart.length) {
    cartContainer.innerHTML = '<div class="empty-state">Your cart is empty. Add something delicious.</div>';
    subtotalEl.textContent = 'NPR 0';
    return;
  }

  cartContainer.innerHTML = cart.map((item) => `
    <div class="cart-item">
      <div>
        <strong>${item.name}</strong><br>
        <small>NPR ${item.price} each</small>
      </div>
      <div class="qty-box">
        <button type="button" data-action="minus" data-id="${item.id}">−</button>
        <span style="padding: 0 8px; font-weight:700; min-width: 26px; text-align: center;">${item.qty}</span>
        <button type="button" data-action="plus" data-id="${item.id}">+</button>
      </div>
    </div>
  `).join('');

  subtotalEl.textContent = `NPR ${getCartTotal()}`;

  document.querySelectorAll('[data-action="plus"]').forEach((button) => {
    button.addEventListener('click', () => changeQty(button.dataset.id, 1));
  });

  document.querySelectorAll('[data-action="minus"]').forEach((button) => {
    button.addEventListener('click', () => changeQty(button.dataset.id, -1));
  });
}

function initializeCatalog() {
  const catalog = document.getElementById('productGrid');
  if (!catalog) return;

  catalog.innerHTML = products.map((product) => `
    <article class="product-card">
      <img class="product-image" src="${product.image}" alt="${product.name}" />
      <p class="product-title">${product.name}</p>
      <div class="product-desc">${product.description}</div>
      <div class="product-footer">
        <span class="price-tag">NPR ${product.price}</span>
        <button class="add-btn" data-product-id="${product.id}">Add</button>
      </div>
    </article>
  `).join('');

  catalog.querySelectorAll('[data-product-id]').forEach((button) => {
    button.addEventListener('click', () => addToCart(button.dataset.productId));
  });
}

window.addEventListener('DOMContentLoaded', () => {
  initializeCatalog();
  renderCart();
});

window.cartHelpers = { addToCart, getCart, getCartTotal, saveCart, changeQty };
