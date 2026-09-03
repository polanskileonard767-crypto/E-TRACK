// E-TRACK V2 NAVIGATION CORE — polished destination navigation
(function(){
  const NOMINATIM='https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=';
  const OSRM='https://router.project-osrm.org/route/v1/driving/';
  let destination=null, navRoute=null, navSteps=[], stepIndex=0, navWatchId=null, rerouteBusy=false, lastRouteAt=0, destinationMarker=null;
  const esc=t=>String(t??'').replace(/[&<>\'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));
  const fmtDist=m=>m>=1000?(m/1000).toFixed(m>=10000?0:1)+' km':Math.max(0,Math.round(m))+' m';
  const fmtTime=s=>{s=Math.max(0,Math.round(s));const h=Math.floor(s/3600),m=Math.floor(s%3600/60);return h?`${h} h ${m} min`:`${m} min`};
  const dir=(type,mod)=>{if(type==='arrive')return 'Ziel erreicht';if(type==='depart')return 'Losfahren';if(type==='roundabout'||type==='rotary')return 'Kreisverkehr';if((mod||'').includes('left'))return 'Links abbiegen';if((mod||'').includes('right'))return 'Rechts abbiegen';if(mod==='straight')return 'Geradeaus';return type==='uturn'?'Wenden':'Weiterfahren'};
  function nearestGeometry(here){const g=navRoute?.geometry?.coordinates||[];let best=Infinity,idx=0;for(let i=0;i<g.length;i++){const d=dist(here,[g[i][1],g[i][0]]);if(d<best){best=d;idx=i}}return {d:best,idx};}
  function remainingDistance(here){const g=navRoute?.geometry?.coordinates||[];if(g.length<2)return navRoute?.distance||0;const n=nearestGeometry(here);let r=dist(here,[g[n.idx][1],g[n.idx][0]]);for(let i=n.idx;i<g.length-1;i++)r+=dist([g[i][1],g[i][0]],[g[i+1][1],g[i+1][0]]);return r;}
  function stepDistance(here,s){const c=s?.maneuver?.location;if(!c||!here)return Infinity;return dist(here,[c[1],c[0]]);}
  function setPanel(){
    const ride=document.getElementById('rideScreen');if(!ride||!document.getElementById('navPanel'))return;
    const p=document.getElementById('navPanel');p.className='nav-panel hidden';p.innerHTML=`<div class="nav-top"><div class="nav-icon" id="navIcon">➜</div><div class="nav-copy"><span class="nav-eyebrow">ZIELFÜHRUNG</span><strong id="navInstruction">Route wird berechnet…</strong><span class="nav-road" id="navStreet">–</span></div><button id="navStop" class="nav-stop" aria-label="Zielführung beenden">×</button></div><div class="nav-meta"><span><b id="navRemaining">–</b><small>verbleibend</small></span><span><b id="navEta">–</b><small>geschätzt</small></span><span><b id="navNext">–</b><small>nächster Schritt</small></span></div><div class="nav-progress"><i id="navProgress"></i></div>`;
    document.getElementById('navStop').onclick=stopNavigation;
  }
  function modal(){
    if(document.getElementById('destinationModal'))return document.getElementById('destinationModal');
    const m=document.createElement('div');m.id='destinationModal';m.className='modal hidden destination-modal';m.innerHTML=`<div class="modal-card"><div class="modal-head"><div><span class="nav-eyebrow">NEUE ZIELFAHRT</span><h2>Ziel auswählen</h2></div><button class="back" id="closeDestination">×</button></div><div class="search-box"><span>⌖</span><input id="destinationQuery" autocomplete="off" placeholder="Adresse, Ort oder Platz…"><button id="destinationSearch">Suchen</button></div><div id="destResults" class="dest-results"><div class="dest-current"><span>◎</span> Dein aktueller Standort wird automatisch als Startpunkt verwendet.</div><div class="dest-hint">Tipp: „Tampere Bahnhof“ oder eine genaue Adresse</div></div></div>`;
    document.body.appendChild(m);
    const close=()=>m.classList.add('hidden');document.getElementById('closeDestination').onclick=close;
    document.getElementById('destinationSearch').onclick=()=>searchDest();document.getElementById('destinationQuery').onkeydown=e=>{if(e.key==='Enter')searchDest()};
    return m;
  }
  async function searchDest(){
    const input=document.getElementById('destinationQuery'),q=input?.value.trim();if(!q)return;
    const box=document.getElementById('destResults');box.innerHTML='<div class="dest-loading">Ziele werden gesucht…</div>';
    try{const r=await fetch(NOMINATIM+encodeURIComponent(q),{headers:{Accept:'application/json'}});if(!r.ok)throw Error();const a=await r.json();if(!a.length){box.innerHTML='<div class="dest-hint">Kein Ziel gefunden. Versuch es mit einer genaueren Adresse.</div>';return}
      box.innerHTML=a.map((x,i)=>`<button class="dest-result" data-i="${i}"><span class="result-pin">⌖</span><span><b>${esc(x.display_name.split(',')[0])}</b><small>${esc(x.display_name)}</small></span><span>›</span></button>`).join('');
      box.querySelectorAll('.dest-result').forEach((b,i)=>b.onclick=()=>{const x=a[i];document.getElementById('destinationModal').classList.add('hidden');startTo([Number(x.lat),Number(x.lon),x.display_name])});
    }catch{box.innerHTML='<div class="dest-hint">Suche fehlgeschlagen. Bitte Internet prüfen.</div>'}
  }
  async function current(){return new Promise((res,rej)=>navigator.geolocation.getCurrentPosition(res,rej,{enableHighAccuracy:true,timeout:15000,maximumAge:0}))}
  async function route(from,to){const u=OSRM+from[1]+','+from[0]+';'+to[1]+','+to[0]+'?overview=full&geometries=geojson&steps=true';const r=await fetch(u);if(!r.ok)throw Error();const d=await r.json();if(d.code!=='Ok'||!d.routes?.[0])throw Error();return d.routes[0]}
  function draw(r){
    navRoute=r;navSteps=(r.legs||[]).flatMap(l=>l.steps||[]).filter(s=>s.distance>0||s.maneuver?.type==='arrive');stepIndex=navSteps.findIndex(s=>s.maneuver?.type==='depart');if(stepIndex<0)stepIndex=0;
    const p=document.getElementById('navPanel');p.classList.remove('hidden');
    if(window.savedRouteLine&&window.map){window.map.removeLayer(window.savedRouteLine);window.savedRouteLine=null}
    if(window.map){window.savedRouteLine=L.geoJSON(r.geometry,{style:{color:'#ff3040',weight:7,opacity:.92,lineCap:'round',lineJoin:'round'}}).addTo(window.map)}
    if(destinationMarker&&window.map)window.map.removeLayer(destinationMarker);
    if(window.map){destinationMarker=L.circleMarker([destination[0],destination[1]],{radius:10,color:'#fff',weight:3,fillColor:'#ff3040',fillOpacity:1}).addTo(window.map);destinationMarker.bindTooltip('Ziel');window.map.fitBounds(window.savedRouteLine.getBounds(),{padding:[28,100]})}
    updateNav(window.__etrackNavPosition||null);
  }
  function updateNav(here){
    if(!navRoute)return;let s=navSteps[stepIndex];if(here){while(stepIndex<navSteps.length-1&&stepDistance(here,s)<24){stepIndex++;s=navSteps[stepIndex]}}
    const remaining=here?remainingDistance(here):navRoute.distance,arrived=!!here&&dist(here,destination)<28,panel=document.getElementById('navPanel'),inst=document.getElementById('navInstruction');if(!inst)return;
    panel.classList.toggle('arrived',arrived);inst.textContent=arrived?'Ziel erreicht':dir(s?.maneuver?.type,s?.maneuver?.modifier);document.getElementById('navStreet').textContent=arrived?(destination[2]||'Ziel'):((s?.name||'Route').trim()||'Der Straße folgen');document.getElementById('navRemaining').textContent=fmtDist(arrived?0:remaining);document.getElementById('navEta').textContent=arrived?'JETZT':fmtTime(navRoute.duration*(remaining/Math.max(1,navRoute.distance)));document.getElementById('navNext').textContent=navSteps[stepIndex+1]&&here?fmtDist(stepDistance(here,navSteps[stepIndex+1])):'–';document.getElementById('navProgress').style.width=Math.min(100,Math.max(0,(1-remaining/Math.max(1,navRoute.distance))*100))+'%';
    if(arrived)stopNavWatch();
  }
  async function startTo(to){if(!navigator.geolocation)return alert('Dieser Browser unterstützt kein GPS.');const b=document.getElementById('startDestination');if(b)b.disabled=true;try{const p=await current();destination=to;const r=await route([p.coords.latitude,p.coords.longitude],to);if(window.startTracking)window.startTracking();setTimeout(()=>{window.__etrackNavPosition=[p.coords.latitude,p.coords.longitude];draw(r);startNavWatch()},450)}catch{alert('Zielführung konnte nicht berechnet werden. Prüfe Standort und Internet.')}finally{if(b)b.disabled=false}}
  function startNavWatch(){stopNavWatch();navWatchId=navigator.geolocation.watchPosition(async p=>{const here=[p.coords.latitude,p.coords.longitude];window.__etrackNavPosition=here;updateNav(here);if(navRoute&&!rerouteBusy&&Date.now()-lastRouteAt>15000&&nearestGeometry(here).d>90){rerouteBusy=true;try{const r=await route(here,destination);lastRouteAt=Date.now();draw(r)}catch{}finally{rerouteBusy=false}}},{enableHighAccuracy:true,maximumAge:0,timeout:20000});lastRouteAt=Date.now()}
  function stopNavWatch(){if(navWatchId!==null)navigator.geolocation.clearWatch(navWatchId);navWatchId=null}
  function clearNav(){stopNavWatch();destination=null;navRoute=null;navSteps=[];stepIndex=0;window.__etrackNavPosition=null;if(destinationMarker&&window.map){window.map.removeLayer(destinationMarker);destinationMarker=null}if(window.savedRouteLine&&window.map){window.map.removeLayer(window.savedRouteLine);window.savedRouteLine=null}const p=document.getElementById('navPanel');if(p)p.classList.add('hidden')}
  function stopNavigation(){clearNav();if(typeof window.stop==='function')window.stop()}
  function openDestination(){modal().classList.remove('hidden');const i=document.getElementById('destinationQuery');i.value='';setTimeout(()=>i.focus(),60)}
  function patchHome(){const b=document.getElementById('startDestination');if(b)b.onclick=openDestination}
  function patchRoutes(){document.querySelectorAll('#routeList [data-follow]').forEach(b=>{b.textContent='⌖ Als Ziel nutzen';b.onclick=()=>{const r=JSON.parse(localStorage.getItem('e-track-routes')||'[]')[+b.dataset.follow];if(!r?.points?.length)return;const last=r.points[r.points.length-1];startTo([last[0],last[1],r.name||'Gespeichertes Ziel'])}})}
  setPanel();patchHome();modal();
  const oldRender=window.renderRoutes;window.renderRoutes=function(){if(oldRender)oldRender();setTimeout(patchRoutes,0)};
  document.addEventListener('DOMContentLoaded',()=>{setPanel();patchHome();modal()});
  const finishButton=document.getElementById('stopRide');const baseStop=window.stop;if(finishButton&&baseStop)finishButton.onclick=()=>{clearNav();baseStop()};
  window.addEventListener('beforeunload',stopNavWatch);
})();
