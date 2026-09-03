const startButton = document.getElementById('startRide');
const routesButton = document.getElementById('routes');

startButton.addEventListener('click', () => {
  if (!('geolocation' in navigator)) {
    alert('Dein Gerät unterstützt keine GPS-Ortung im Browser.');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      alert(`GPS bereit!\nStandort: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
      // Live-Karte und Streckenaufzeichnung kommen als Nächstes.
    },
    () => alert('GPS-Berechtigung wurde nicht erteilt.')
  );
});

routesButton.addEventListener('click', () => {
  alert('Gespeicherte Routen kommen als Nächstes.');
});
