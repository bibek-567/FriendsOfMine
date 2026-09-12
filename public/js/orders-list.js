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
    .map((item) => `${escapeHtml(item.name || 'Item')} x${Number(item.qty) || 0}`)
    .join('<br>');
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
      tableBody.innerHTML = '<tr><td colspan="6">No orders yet.</td></tr>';
      return;
    }

    tableBody.innerHTML = result.orders.map((order) => `
      <tr>
        <td>#${order.orderId}</td>
        <td>${escapeHtml(order.customerName || 'Guest Customer')}</td>
        <td>${formatItems(order.items)}</td>
        <td>${order.totalAmount || 0}</td>
        <td><span class="status-pill">${escapeHtml(order.status || 'pending')}</span></td>
        <td>${new Date(order.createdAt || Date.now()).toLocaleString()}</td>
      </tr>
    `).join('');
  } catch (error) {
    tableBody.innerHTML = `<tr><td colspan="6">${escapeHtml(error.message || 'Unable to load orders right now.')}</td></tr>`;
  }
}

document.addEventListener('DOMContentLoaded', loadOrders);
