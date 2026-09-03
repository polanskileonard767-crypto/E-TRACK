(function(){
  const originalUpdate=window.update;
  let matchBusy=false;
  let matchToken=0;
  function sampleGeometry(coords,count){
    if(!coords?.length||count<1)return [];
    if(coords.length<=count)return coords.map(c=>[c[1],c[0]]);
    const out=[];
    for(let i=0;i<count;i++){
      const idx=Math.round(i*(coords.length-1)/(count-1));
      const c=coords[idx];
      out.push([c[1],c[0]]);
    }
    return out;
  }
  async function matchRoad(){
    if(matchBusy||!points||points.length<3||!routeLine)return;
    matchBusy=true;
    const token=++matchToken;
    try{
      const tailCount=Math.min(8,points.length);
      const tail=points.slice(-tailCount);
      const coords=tail.map(p=>`${p[1].toFixed(6)},${p[0].toFixed(6)}`).join(';');
      const url=`https://router.project-osrm.org/match/v1/driving/${coords}?overview=full&geometries=geojson&steps=false&gaps=ignore`;
      const res=await fetch(url,{headers:{Accept:'application/json'}});
      if(!res.ok)throw new Error('road-match');
      const data=await res.json();
      const geom=data?.matchings?.[0]?.geometry?.coordinates;
      if(token!==matchToken||!geom?.length)return;
      const snapped=sampleGeometry(geom,tailCount);
      if(snapped.length<2)return;
      for(let i=0;i<snapped.length;i++)points[points.length-tailCount+i]=snapped[i];
      lastPosition=snapped[snapped.length-1];
      const old=routeLine.getLatLngs();
      const prefix=old.slice(0,Math.max(0,old.length-tailCount));
      routeLine.setLatLngs(prefix.concat(snapped));
      setMarker(snapped[snapped.length-1][0],snapped[snapped.length-1][1]);
      if(settings.autoCenter)map.setView(snapped[snapped.length-1],map.getZoom(),{animate:false});
      $('gpsStatus').textContent='GPS · STRASSE ERKANNT';
    }catch(e){
      // GPS tracking continues normally if the road-matching service is unavailable.
    }finally{
      matchBusy=false;
    }
  }
  window.update=function(p){
    const before=points.length;
    originalUpdate(p);
    if(points.length!==before&&points.length>=3&&(points.length%3===0||points.length<=5))matchRoad();
  };
  const oldStop=window.stop;
  window.stop=function(){matchToken++;oldStop();};
})();
