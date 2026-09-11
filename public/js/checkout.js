const STORE_LOCATION = { lat: 28.71152369421902, lng: 80.5890426864205 };

function haversineDistance(lat1, lng1, lat2, lng2) {
  const toRad = (value) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getCart() {
  try {
    return JSON.parse(localStorage.getItem('friends_of_mine_cart') || '[]');
  } catch {
    return [];
  }
}

function getOrderSummary() {
  const cart = getCart();
  return {
    cart,
    total: cart.reduce((sum, item) => sum + Number(item.price) * Number(item.qty), 0),
    itemCount: cart.reduce((sum, item) => sum + Number(item.qty), 0)
  };
}

function renderCheckoutSummary() {
  const summary = getOrderSummary();
  const container = document.getElementById('checkoutItems');
  const totalEl = document.getElementById('checkoutTotal');
  if (!container || !totalEl) return;

  if (!summary.cart.length) {
    container.innerHTML = '<li class="empty-state">No items in your cart.</li>';
    totalEl.textContent = 'NPR 0';
    return;
  }

  container.innerHTML = summary.cart.map((item) => `
    <li><span>${item.name} x${item.qty}</span><strong>NPR ${item.price * item.qty}</strong></li>
  `).join('');
  totalEl.textContent = `NPR ${summary.total}`;
}

async function validateDeliveryLocation() {
  if (!navigator.geolocation) {
    return { eligible: false, reason: 'Geolocation is unavailable in this browser.' };
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const distance = haversineDistance(
          position.coords.latitude,
          position.coords.longitude,
          STORE_LOCATION.lat,
          STORE_LOCATION.lng
        );

        resolve({
          eligible: distance <= 5,
          distance,
          reason: distance <= 5 ? 'Within 5 km delivery range.' : `Outside delivery range. You are ${distance.toFixed(2)} km away.`
        });
      },
      () => resolve({ eligible: false, reason: 'Unable to access your location.' }),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  });
}

async function placeOrder(paymentMethod = 'cod') {
  const form = document.getElementById('checkoutForm');
  if (!form) return;

  if (!form.reportValidity()) return;

  const formData = new FormData(form);
  const payload = {
    customerName: formData.get('name') || 'Guest Customer',
    customerPhone: formData.get('phone') || '9800000000',
    customerEmail: formData.get('email') || '',
    deliveryLocation: formData.get('address') || 'Dhangadi, Nepal',
    paymentMethod,
    totalAmount: getOrderSummary().total,
    items: getOrderSummary().cart,
    deviceToken: window.deviceTracker?.getDeviceToken() || localStorage.getItem('cafe_device_token') || 'local-device',
    lat: formData.get('lat') || '',
    lng: formData.get('lng') || ''
  };

  if (!payload.totalAmount || !payload.items.length) {
    alert('Your cart is empty.');
    return;
  }

  if (paymentMethod !== 'cod') {
    const locationCheck = await validateDeliveryLocation();
    if (!locationCheck.eligible) {
      alert(locationCheck.reason);
      return;
    }
  }

  const url = paymentMethod === 'cod' ? '/api/cod-order' : '/api/initiate-payment';
  let result;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const responseText = await response.text();
    try {
      result = JSON.parse(responseText);
    } catch (error) {
      throw new Error(`Server returned HTTP ${response.status} instead of JSON.`);
    }
  } catch (error) {
    alert(error.message || 'Unable to place the order right now. Please try again.');
    return;
  }

  if (!result.success) {
    alert(result.message || 'Order failed.');
    return;
  }

  if (result.redirectUrl) {
    window.location.href = result.redirectUrl;
    return;
  }

  if (result.form) {
    const paymentForm = document.createElement('form');
    paymentForm.method = 'POST';
    paymentForm.action = result.form.action;
    Object.entries(result.form.fields).forEach(([name, value]) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = value;
      paymentForm.appendChild(input);
    });
    document.body.appendChild(paymentForm);
    paymentForm.submit();
    return;
  }

  localStorage.removeItem('friends_of_mine_cart');
  localStorage.setItem('last_order', JSON.stringify(result.order));
  window.location.href = '/order-success?orderId=' + encodeURIComponent(result.order.orderId || payload.orderId);
}

window.addEventListener('DOMContentLoaded', async () => {
  renderCheckoutSummary();

  const locationButton = document.getElementById('detectLocation');
  if (locationButton) {
    locationButton.addEventListener('click', async () => {
      const check = await validateDeliveryLocation();
      const latInput = document.getElementById('customerLat');
      const lngInput = document.getElementById('customerLng');
      const status = document.getElementById('locationStatus');

      if (status) status.textContent = check.reason;
      if (latInput && lngInput && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
          latInput.value = position.coords.latitude;
          lngInput.value = position.coords.longitude;
        });
      }
    });
  }

  const payNowBtn = document.getElementById('payNowButton');
  const paymentMethod = document.getElementById('paymentMethod');
  if (payNowBtn && paymentMethod) {
    payNowBtn.addEventListener('click', () => placeOrder(paymentMethod.value));
  }
});
