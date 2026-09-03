// E-TRACK V1.4 BETA — UI & ride enhancements layered on the stable V1.3 GPS core.
(function(){
  const oldStart=window.startTracking, oldFollow=window.follow, oldStop=window.stop;
  let paused=false, pauseStarted=0, pausedMs=0, summary=null;
  const routes=()=>{try{return JSON.parse(localStorage.getItem('e-track-routes')||'[]')}catch{return[]}};
  const fmtMs=ms=>{let s=Math.max(0,Math.floor(ms/1000));return [Math.floor(s/3600),Math.floor(s%3600/60),s%60].map(x=>String(x).padStart(2,'0')).join(':')};
  const esc=t=>String(t).replace(/[&<>'\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));
  function dashboard(){
    const r=routes(), total=r.reduce((a,x)=>a+(Number(x.distance)||0),0), longest=r.reduce((a,x)=>Math.max(a,Number(x.distance)||0),0);
    const today=new Date().toLocaleDateString('de-DE');
    const todayKm=r.filter(x=>new Date(x.created).toLocaleDateString('de-DE')===today).reduce((a,x)=>a+(Number(x.distance)||0),0);
    $('homeMetrics').innerHTML=`<div class="metric"><span>GESAMT</span><b>${(total/1000).toFixed(1)} km</b></div><div class="metric"><span>FAHRTEN</span><b>${r.length}</b></div><div class="metric"><span>HEUTE</span><b>${(todayKm/1000).toFixed(1)} km</b></div><div class="metric"><span>REKORD</span><b>${(longest/1000).toFixed(1)} km</b></div>`;
    $('lastRide').innerHTML=r[0]?`<strong>Letzte Fahrt</strong><span>${esc(r[0].name)} · ${(r[0].distance/1000).toFixed(2)} km</span>`:'<strong>Noch keine Fahrt</strong><span>Starte deine erste E-TRACK Fahrt.</span>';
  }
  function injectHome(){
    const home=$('homeScreen');
    if($('homeMetrics'))return;
    const box=document.createElement('div');box.id='homeMetrics';box.className='home-metrics';home.insertBefore(box,home.querySelector('.primary'));
    const last=document.createElement('button');last.id='lastRide';last.className='last-ride';last.type='button';home.insertBefore(last,home.querySelector('.secondary'));
    dashboard();
  }
  function injectRide(){
    if($('pauseRide'))return;
    const stop=$('stopRide');
    const p=document.createElement('button');p.id='pauseRide';p.className='secondary pause';p.textContent='Ⅱ Pause';p.onclick=togglePause;
    stop.parentNode.insertBefore(p,stop);
    const fs=document.createElement('button');fs.id='fullscreenMap';fs.className='map-fs';fs.textContent='⛶';fs.title='Karte maximieren';fs.onclick=()=>{const el=$('map');if(!document.fullscreenElement)el.requestFullscreen?.();else document.exitFullscreen?.()};$('map').parentNode.appendChild(fs);
  }
  function togglePause(){
    if(!paused){
      paused=true;pauseStarted=Date.now();if(watchId!==null)navigator.geolocation.clearWatch(watchId);watchId=null;$('pauseRide').textContent='▶ Weiter';$('gpsStatus').textContent='PAUSIERT';
    }else{
      paused=false;pausedMs+=Date.now()-pauseStarted;$('pauseRide').textContent='Ⅱ Pause';$('gpsStatus').textContent='GPS WIRD GESUCHT…';
      if(navigator.geolocation)watch(update);
    }
  }
  function showSummary(){
    const r=routes()[0];if(!r)return;
    const modal=document.createElement('div');modal.className='summary-modal';modal.innerHTML=`<div class="summary-card"><div class="summary-kicker">FAHRT BEENDET</div><h2>Sauber gefahren. 🛴</h2><div class="summary-grid"><div><span>Distanz</span><b>${(r.distance/1000).toFixed(2)} km</b></div><div><span>Zeit</span><b>${fmtMs(r.duration)}</b></div><div><span>Max.</span><b>${Number(r.maxSpeed||0).toFixed(1)} km/h</b></div><div><span>Punkte</span><b>${r.points?.length||0}</b></div></div><input id="summaryName" value="${esc(r.name)}" maxlength="40"><button id="summarySave" class="primary">✓ Route speichern</button><button id="summaryClose" class="secondary">Zur Routenübersicht</button></div>`;
    document.body.appendChild(modal);
    $('summarySave').onclick=()=>{const rs=routes();const n=$('summaryName').value.trim();if(n&&rs[0]){rs[0].name=n;localStorage.setItem('e-track-routes',JSON.stringify(rs));dashboard()}modal.remove()};
    $('summaryClose').onclick=()=>modal.remove();
  }
  window.startTracking=function(){oldStart();setTimeout(injectRide,80)};
  window.follow=function(r){oldFollow(r);setTimeout(injectRide,80)};
  window.stop=function(){oldStop();setTimeout(()=>{dashboard();showSummary()},100)};
  document.addEventListener('DOMContentLoaded',()=>{injectHome();setInterval(()=>{if($('homeScreen')&&!$('homeScreen').classList.contains('hidden'))dashboard()},5000)});
})();
