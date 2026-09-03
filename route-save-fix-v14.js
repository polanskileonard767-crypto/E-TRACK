// E-TRACK V1.4 BETA — preserve the complete recorded GPS route before async road matching can alter it.
(function(){
  const currentStop=window.stop;
  window.stop=function(){
    const completePoints=Array.isArray(points)?points.map(p=>[Number(p[0]),Number(p[1])]):[];
    const completeDistance=Number(distanceMeters)||0;
    const completeDuration=startedAt?Date.now()-startedAt:0;
    const completeMax=Number(maxSpeed)||0;
    const wasFollowing=!!followingRoute;
    if(!wasFollowing&&completePoints.length>=2&&settings.autoSave){
      const oldAuto=settings.autoSave;
      settings.autoSave=false;
      currentStop();
      settings.autoSave=oldAuto;
      const r=getRoutes();
      r.unshift({name:'Fahrt '+new Date().toLocaleDateString('de-DE'),distance:completeDistance,duration:completeDuration,points:completePoints,created:Date.now(),maxSpeed:completeMax});
      setRoutes(r);
      renderRoutes();
    }else currentStop();
  };
})();
