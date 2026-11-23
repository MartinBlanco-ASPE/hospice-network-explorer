/* Fit source charts inside one centered, consistent dashboard workspace. */
(()=>{'use strict';
 const $=id=>document.getElementById(id),ids=['regulationsFrame','careAreaNetworkFrame','careIssueHeatmapFrame'];let raf=0;
 function fit(){
  cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{
   const header=document.querySelector('body>header'),footer=document.querySelector('body>footer'),height=Math.max(360,innerHeight-header.offsetHeight-footer.offsetHeight-32);
   for(const id of ids){const f=$(id),doc=f.contentDocument,plot=Math.min(1050,Math.max(820,f.clientWidth-360));let target=height;if(id==='regulationsFrame')target=Math.max(height,plot*.7+180);if(id==='careAreaNetworkFrame')target=Math.max(height,Math.max(420,(f.clientWidth-336)*2/3*.7)+180);if(doc?.body&&f.clientWidth<=960&&id!=='careIssueHeatmapFrame')target=Math.max(target,doc.querySelector('main')?.scrollHeight||0);target=Math.ceil(target);if(f.style.height!==target+'px')f.style.height=target+'px';}
  });
 }
 function adapt(id){const f=$(id),doc=f.contentDocument;if(!doc?.head)return;if(!doc.getElementById('qcorDashboardChartLayout')){const s=doc.createElement('style');s.id='qcorDashboardChartLayout';s.textContent=window.QCOR_CHART_LAYOUT_CSS;doc.head.append(s);}if(id!=='careIssueHeatmapFrame'&&!doc.getElementById('qcorReadableLabels')&&(doc.getElementById('originalSunburst')||doc.getElementById('cnHost'))){const s=doc.createElement('script');s.id='qcorReadableLabels';s.textContent=window.QCOR_CHART_READABILITY_JS;doc.body.append(s);}fit();f.contentWindow.dispatchEvent(new f.contentWindow.Event('resize'));}
 for(const id of ids)$(id).addEventListener('load',()=>adapt(id));
 const classification=$('classificationFrame');classification.addEventListener('load',()=>{const doc=classification.contentDocument;if(!doc?.body)return;const controls=doc.querySelector('.tr-card .chart-actions');if(controls){controls.style.flexWrap='wrap';controls.style.maxWidth='100%';controls.style.minWidth='0';}const leafControl=doc.querySelector('.tr-select');if(leafControl){leafControl.style.flexWrap='wrap';leafControl.style.maxWidth='100%';}const update=()=>{const height=Math.max(500,Math.ceil(doc.body.scrollHeight));if(Math.abs(classification.getBoundingClientRect().height-height)>2)classification.style.height=height+'px';};new classification.contentWindow.ResizeObserver(update).observe(doc.body);update();});
 addEventListener('resize',fit);addEventListener('qcor-dashboard-page',fit);new ResizeObserver(fit).observe(document.querySelector('body>header'));for(const id of ids)adapt(id);fit();
 window.QCOR_DASHBOARD_LAYOUT={fit};
})();
