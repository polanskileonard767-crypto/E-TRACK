// E-TRACK V1.5 — destination navigation instead of route replay
(function(){
  const nominatim='https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=';
  const osrm='https://router.project-osrm.org/route/v1/driving/';
  let destination=null, navRoute=null, navSteps=[], stepIndex=0;
  const originalFollow=window.follow;
  const esc=t=>String(t??'').replace(/[&<>'\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));
  const fmtDist=m=>m>=1000?(m/1000).toFixed(1)+' km':Math.round(m)+' m';
  const direction=(type,mod)=>{
    if(type==='arrive')return 'Ziel erreicht';
    if(type==='depart')return 'Losfahren';
    if(type==='roundabout'||type==='rotary')return 'Im Kreisverkehr';
    const m=mod||'';
    if(m.includes('left'))return 'Links abbiegen';
    if(m.includes('right'))return 'Rechts abbiegen';
    if(m==='straight')return 'Geradeaus';
    return type==='turn'?'Abbiegen':'Weiterfahren';
  };
  function setNavPanel(){
    const ride=document.getElementById('rideScreen'); if(!ride||document.getElementById('navPanel'))return;
    const p=document.createElement('div');p.id='navPanel';p.className='nav-panel hidden';
    p.innerHTML='<div class="nav-top"><div><span class="nav-eyebrow">ZIELFÜHRUNG</span><strong id="navInstruction">Route wird berechnet…</strong></div><button id="navStop" class="nav-stop">×</button></div><div class="nav-meta"><span id="navStreet">–</span><b id="navRemaining">–</b></div>';
    const mapWrap=document.querySelector('.map-wrap');mapWrap.parentNode.insertBefore(p,mapWrap);
    document.getElementById('navStop').onclick=()=>{destination=null;navRoute=null;navSteps=[];document.getElementById('navPanel').classList.add('hidden');if(window.stop)window.stop()};
  }
  async function geocode(q){
    const r=await fetch(nominatim+encodeURIComponent(q),{headers:{'Accept':'application/json'}});if(!r.ok)throw Error('Geocoding');
    const a=await r.json();if(!a.length)throw Error('Kein Ziel gefunden');return [Number(a[0].lat),Number(a[0].lon),a[0].display_name];
  }
  function currentPosition(){return new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:15000,maximumAge:0}))}
  async function calculateRoute(from,to){
    const url=osrm+from[1]+','+from[0]+';'+to[1]+','+to[0]+'?overview=full&geometries=geojson&steps=true';
    const r=await fetch(url);if(!r.ok)throw Error('Routing');const data=await r.json();if(data.code!=='Ok'||!data.routes?.[0])throw Error('Keine Route gefunden');return data.routes[0];
  }
  function showNavigation(route){
    navRoute=route;navSteps=(route.legs||[]).flatMap(x=>x.steps||[]);stepIndex=0;
    const panel=document.getElementById('navPanel');panel.classList.remove('hidden');
    if(window.map){if(window.savedRouteLine){map.removeLayer(window.savedRouteLine);window.savedRouteLine=null}window.savedRouteLine=L.geoJSON(route.geometry,{style:{color:'#ff3038',weight:6,opacity:.95}}).addTo(map);map.fitBounds(savedRouteLine.getBounds(),{padding:[30,90]})}
    updateNav();
  }
  function updateNav(){
    if(!navRoute)return;const s=navSteps[stepIndex];const inst=document.getElementById('navInstruction');if(!inst)return;
    const name=s?.name?.trim();inst.textContent=direction(s?.maneuver?.type,s?.maneuver?.modifier)+(name?' · '+name:'');
    document.getElementById('navStreet').textContent=name||destination?.[2]||'Ziel';
    document.getElementById('navRemaining').textContent=fmtDist(navRoute.distance);
  }
  async function startDestination(){
    if(!navigator.geolocation)return alert('GPS wird von diesem Browser nicht unterstützt.');
    const q=prompt('Wohin möchtest du fahren?\n\nAdresse, Ort oder Ziel eingeben:');if(!q?.trim())return;
    const btn=document.getElementById('startDestination');if(btn){btn.disabled=true;btn.textContent='Ziel wird gesucht…'}
    try{
      const pos=await currentPosition();const from=[pos.coords.latitude,pos.coords.longitude];
      destination=await geocode(q.trim());const route=await calculateRoute(from,destination);
      if(window.startTracking)window.startTracking();
      setTimeout(()=>showNavigation(route),500);
    }catch(e){alert(e.message==='Kein Ziel gefunden'?'Ziel nicht gefunden. Bitte genauer eingeben.':'Zielführung konnte nicht berechnet werden. Prüfe Internet und Standortzugriff.');}
    finally{if(btn){btn.disabled=false;btn.textContent='⌖ Ziel eingeben'}}
  }
  function injectHome(){
    const home=document.getElementById('homeScreen');if(!home||document.getElementById('startDestination'))return;
    const b=document.createElement('button');b.id='startDestination';b.className='destination-btn';b.innerHTML='<span class="destination-icon">⌖</span><span><b>Ziel eingeben</b><small>Zielführung mit Karte & Route</small></span><span class="destination-arrow">›</span>';b.onclick=startDestination;
    const primary=document.getElementById('startRide');home.insertBefore(b,primary);
    primary.textContent='＋ Freie Fahrt';
  }
  function patchRouteLabels(){document.querySelectorAll('[data-follow]').forEach(b=>{b.textContent='⌖ Als Ziel nutzen';});}
  const oldRender=window.renderRoutes;
  window.renderRoutes=function(){oldRender();setTimeout(patchRouteLabels,0)};
  const oldFollowFn=window.follow;
  window.follow=function(route){
    const pts=route?.points||[];if(pts.length<2)return alert('Diese Route enthält kein gültiges Ziel.');
    const last=pts[pts.length-1];prompt('Dieses gespeicherte Ziel ist:',route.name||'Route');
    destination=[last[0],last[1],route.name||'Gespeichertes Ziel'];
    startDestinationFromPoint(last);
  };
  async function startDestinationFromPoint(to){
    try{const p=await currentPosition();const route=await calculateRoute([p.coords.latitude,p.coords.longitude],to);if(window.startTracking)window.startTracking();setTimeout(()=>showNavigation(route),500)}catch(e){alert('Zielführung konnte nicht berechnet werden.')} 
  }
  setNavPanel();injectHome();
  document.addEventListener('DOMContentLoaded',()=>{setNavPanel();injectHome()});
  setInterval(()=>{if(navRoute&&window.lastPosition){
    const here=window.lastPosition;let best=stepIndex,bd=Infinity;
    for(let i=stepIndex;i<navSteps.length;i++){const c=navSteps[i]?.maneuver?.location;if(c){const d=dist(here,[c[1],c[0]]);if(d<bd){bd=d;best=i}}}
    if(best>stepIndex&&bd<80){stepIndex=best;updateNav()}
  }},1500);
})();
