function getDeviceToken() {
  return window.deviceTracker?.getDeviceToken() || localStorage.getItem('cafe_device_token') || 'guest';
}

async function loadOrders() {
  const tableBody = document.getElementById('ordersTableBody');
  if (!tableBody) return;

  try {
    const response = await fetch('/api/orders?deviceToken=' + encodeURIComponent(getDeviceToken()));
    const result = await response.json();
    if (!result.success || !result.orders || !result.orders.length) {
      tableBody.innerHTML = '<tr><td colspan="5">No orders yet.</td></tr>';
      return;
    }

    tableBody.innerHTML = result.orders.map((order) => `
      <tr>
        <td>#${order.orderId}</td>
        <td>${order.customerName}</td>
        <td>${order.totalAmount || 0}</td>
        <td><span class="status-pill">${order.status || 'pending'}</span></td>
        <td>${new Date(order.createdAt || Date.now()).toLocaleString()}</td>
      </tr>
    `).join('');
  } catch (error) {
    tableBody.innerHTML = '<tr><td colspan="5">Unable to load orders right now.</td></tr>';
  }
}

document.addEventListener('DOMContentLoaded', loadOrders);
