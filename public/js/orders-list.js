function getDeviceToken() {
  return window.deviceTracker?.getDeviceToken() || localStorage.getItem('cafe_device_token') || 'guest';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatItems(items) {
  if (!Array.isArray(items) || !items.length) return 'No item details';
  return items
    .map((item) => {
      if (typeof item === 'string') return escapeHtml(item);
      const name = item.name || item.title || item.productName || 'Item';
      const quantity = item.qty ?? item.quantity ?? item.count ?? 0;
      return `${escapeHtml(name)} x${Number(quantity) || 0}`;
    })
    .join('<br>');
}

function getDeliveryStatus(order) {
  if (order.deliveryStatus === 'delivered') return 'Food is Delivered';
  if (order.deliveryStatus === 'tracking' && Number.isFinite(Number(order.driverLat)) && Number.isFinite(Number(order.driverLng))) {
    const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${order.driverLat},${order.driverLng}`)}`;
    return `<a class="status-action" href="${mapUrl}" target="_blank" rel="noopener">View</a>`;
  }
  return 'Food is Preparing';
}

async function loadOrders() {
  const tableBody = document.getElementById('ordersTableBody');
  if (!tableBody) return;

  try {
    const response = await fetch('/api/orders?deviceToken=' + encodeURIComponent(getDeviceToken()));
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Unable to fetch your orders.');
    }
    if (!result.success || !result.orders || !result.orders.length) {
      tableBody.innerHTML = '<tr><td colspan="7">No orders yet.</td></tr>';
      return;
    }

    tableBody.innerHTML = result.orders.map((order) => `
      <tr>
        <td>#${order.orderId}</td>
        <td>${escapeHtml(order.customerName || 'Guest Customer')}</td>
        <td>${formatItems(order.items)}</td>
        <td>NPR ${Number(order.totalAmount) || 0}</td>
        <td><span class="status-pill">${escapeHtml(order.status || 'pending')}</span></td>
        <td>${getDeliveryStatus(order)}</td>
        <td>${new Date(order.createdAt || Date.now()).toLocaleString()}</td>
      </tr>
    `).join('');
  } catch (error) {
    tableBody.innerHTML = `<tr><td colspan="7">${escapeHtml(error.message || 'Unable to load orders right now.')}</td></tr>`;
  }
}

document.addEventListener('DOMContentLoaded', loadOrders);
setInterval(loadOrders, 10000);
