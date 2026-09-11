const DEVICE_KEY = 'cafe_device_token';

function ensureDeviceToken() {
  let token = localStorage.getItem(DEVICE_KEY);
  if (!token) {
    token = `fom-${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
    localStorage.setItem(DEVICE_KEY, token);
  }
  return token;
}

function getDeviceToken() {
  return localStorage.getItem(DEVICE_KEY) || ensureDeviceToken();
}

function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      (error) => reject(error),
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 20000 }
    );
  });
}

ensureDeviceToken();

window.deviceTracker = { ensureDeviceToken, getDeviceToken, getCurrentLocation };
