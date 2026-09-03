let map = null;
let marker = null;
let routeLine = null;
let watchId = null;
let points = [];
let startedAt = null;
let timerId = null;
let distanceMeters = 0;

const $ = (id) => document.getElementById(id);
const home = $('homeScreen');
const ride = $('rideScreen');
const routesScreen = $('routesScreen');

function show(screen) {
  [home, ride, routesScreen].forEach(s => s.classList.add('hidden'));
  screen.classList.remove('hidden');
}

function distanceBetween(a, b) {
  const R = 6371000;
  const lat1 = a[0] * Math.PI / 180, lat2 = b[0] * Math.PI / 180;
  const dLat = (b[0] - a[0]) * Math.PI / 180;
  const dLon = (b[1] - a[1]) * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function formatTime(ms) {
  const total = Math.floor(ms / 1000);
  const h = String(Math.floor(total / 3600)).padStart(2, '0');
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function initMap(lat, lon) {
  if (!map) {
    map = L.map('map', { zoomControl: false }).setView([lat, lon], 17);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    routeLine = L.polyline([], { color: '#ff3030', weight: 5, opacity: 0.9 }).addTo(map);
  } else {
    map.setView([lat, lon], 17);
  }
}

function updatePosition(position) {
  const lat = position.coords.latitude;
  const lon = position.coords.longitude;
  const current = [lat, lon];
  const accuracy = Math.round(position.coords.accuracy || 0);

  if (points.length) {
    const segment = distanceBetween(points[points.length - 1], current);
    if (segment >= 2 && segment < 100) distanceMeters += segment;
  }

  points.push(current);
  marker.setLatLng(current);
  routeLine.setLatLngs(points);
  map.setView(current, map.getZoom(), { animate: true });
  $('distance').textContent = `${(distanceMeters / 1000).toFixed(2)} km`;
  $('accuracy').textContent = `±${accuracy} m`;
}

function startTracking() {
  if (!navigator.geolocation) {
    alert('GPS wird von diesem Browser nicht unterstützt.');
    return;
  }

  points = [];
  distanceMeters = 0;
  startedAt = Date.now();
  $('time').textContent = '00:00:00';
  $('distance').textContent = '0.00 km';
  $('accuracy').textContent = '…';
  $('gpsStatus').textContent = 'GPS AKTIV';
  show(ride);

  navigator.geolocation.getCurrentPosition((position) => {
    const { latitude, longitude } = position.coords;
    initMap(latitude, longitude);
    marker = L.circleMarker([latitude, longitude], {
      radius: 8, color: '#ffffff', weight: 3, fillColor: '#ff3030', fillOpacity: 1
    }).addTo(map);
    updatePosition(position);

    watchId = navigator.geolocation.watchPosition(updatePosition, gpsError, {
      enableHighAccuracy: true,
      maximumAge: 1000,
      timeout: 10000
    });
  }, gpsError, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });

  timerId = setInterval(() => $('time').textContent = formatTime(Date.now() - startedAt), 1000);
}

function gpsError() {
  $('gpsStatus').textContent = 'GPS FEHLER';
  alert('GPS konnte nicht bestimmt werden. Bitte Standortzugriff erlauben.');
}

function stopTracking() {
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  if (timerId) clearInterval(timerId);
  watchId = null;
  timerId = null;

  if (points.length >= 2) {
    const routes = JSON.parse(localStorage.getItem('e-track-routes') || '[]');
    routes.unshift({
      name: `Fahrt ${new Date().toLocaleDateString('de-DE')}`,
      distance: distanceMeters,
      duration: Date.now() - startedAt,
      points,
      created: Date.now()
    });
    localStorage.setItem('e-track-routes', JSON.stringify(routes));
  }
  renderRoutes();
  show(routesScreen);
}

function renderRoutes() {
  const list = $('routeList');
  const routes = JSON.parse(localStorage.getItem('e-track-routes') || '[]');
  if (!routes.length) {
    list.innerHTML = '<div class="route-empty">Noch keine Fahrten gespeichert.<br><br>Starte deine erste Fahrt! 🛴</div>';
    return;
  }
  list.innerHTML = routes.map((r, i) => `
    <div class="route-item">
      <strong>${escapeHtml(r.name)}</strong>
      <span>${(r.distance / 1000).toFixed(2)} km · ${formatTime(r.duration)}</span>
    </div>`).join('');
}

function escapeHtml(text) {
  return text.replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

$('startRide').addEventListener('click', startTracking);
$('stopRide').addEventListener('click', stopTracking);
$('routes').addEventListener('click', () => { renderRoutes(); show(routesScreen); });
$('backHome').addEventListener('click', () => show(home));
$('settings').addEventListener('click', () => alert('Einstellungen kommen in V0.3.'));
