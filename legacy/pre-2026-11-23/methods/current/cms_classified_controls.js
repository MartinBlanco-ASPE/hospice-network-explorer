/* Four source-classified views in the review preview; main explorer is untouched. */
$('guidedView').replaceChildren();for(const[value,label]of Object.entries(CMS_VIEWS)){const o=elem('option','',Object.keys(CMS_VIEWS).indexOf(value)+1+' · '+label);o.value=value;$('guidedView').append(o);}
$('severityFilter').replaceChildren(Object.assign(elem('option','','All records'),{value:'all'}));$('severityFilter').closest('.guided-field').hidden=true;
$('severityMainField').hidden=true;$('severityTerms').closest('label').hidden=true;
$('edgeUnit').querySelector('[value="severity"]').remove();
guidedPreset=function(view){return {edgeUnit:'ppmi',colorLayer:view==='general'?'community':'teal',severityFilter:'all',severityTerms:view!=='general',yearFilter:'all',textFilter:'all',threshold:Math.log2(1.5),shared:'25',neighbors:'4',isolates:false,showCounts:false,groupResolution:'1'};};
resetGuidedPreset=function(view=guidedState.view,draw=true){view=view in CMS_VIEWS?view:'general';guidedState.view=view;guidedState.lens=view;writeGuidedSettings(guidedPreset(view));$('guidedView').value=view;guidedState.comparisonKey=null;syncGuidedControls();if(draw){
 const resumeSimulation=!!window.REMOVAL_SIM?.state.active||!!cmsPendingSimulationNetwork;
 cmsPendingSimulationNetwork=null;
 if(resumeSimulation)REMOVAL_SIM.enable(false);
 render();
 // A view is a fresh graph: fit before simulation captures its baseline camera.
 network.releaseNode();network.fit({animation:false});network.moveTo({scale:network.getScale()*.88,animation:false});
 if(resumeSimulation)cmsResumeSimulationAfterLayout(network);
 }};
GUIDED.setView=resetGuidedPreset;
const cmsSyncBefore=syncGuidedControls;syncGuidedControls=function(){cmsSyncBefore();$('severityMainField').hidden=true;$('comparisonControls').hidden=true;for(const o of $('edgeUnit').options)o.disabled=cmsClassified()&&o.value!=='ppmi';};
const cmsExplanationBefore=renderGuidedExplanation;renderGuidedExplanation=function(){cmsExplanationBefore();if(mode==='phrase'){const heading=$('connectionDescription').querySelector('h3');if(heading)heading.textContent=CMS_VIEWS[cmsView()];}};
const cmsLegendBefore=renderLegend;renderLegend=function(){cmsLegendBefore();for(const span of $('legend').querySelectorAll('span'))if(span.textContent==='Severity families')span.textContent='Top 5 deficiency tags';};
const cmsColorBefore=renderColorDescription;renderColorDescription=function(){cmsColorBefore();if(mode==='phrase'&&$('colorLayer').value==='teal')$('colorDescription').replaceChildren(elem('h3','','Neutral node color'),elem('p','','Care phrases are teal. Red diamonds identify the five leading source deficiency tags in this cohort; red is a display category, not a numerical severity or harm score.'));};
const cmsReadingBefore=renderReadingGuide;renderReadingGuide=function(){cmsReadingBefore();if(mode!=='phrase')return;
 readingLine('readConnections','Connections.','Lines link features present in the same source record more often than an independence baseline predicts. Each selected record has equal weight; no severity score or passage-screen weight is used.');
 readingLine('readColors','Colors and shapes.',cmsClassified()?'Circles are care phrases. Diamonds are the top five source deficiency tags, ranked by distinct hospices in this cohort. Isolated top-five tags remain visible; their absence of qualifying links is not evidence of harmless care.':'Colors group care phrases by their displayed connections. These are exploratory wording clusters, not severity grades or validated themes.');
 const g=currentGraph();$('connectionMath').textContent=`PPMI = max(0, log₂(lift)); lift = joint record share ÷ the product of separate record shares. N = ${count(g.documents)} selected source records. The selected threshold applies to care-phrase pairs; deficiency links require 10 shared records. The union of each endpoint's ${$('neighbors').value} strongest eligible links is retained.`;
 if(!isPPMI())$('connectionMath').textContent='Advanced comparison: '+$('edgeUnit').selectedOptions[0].textContent+'. The selected cohort is unchanged.';
 const expression=$('liftFormula').querySelector('math').innerHTML;readingFormula('liftFormula',expression,'Compare joint feature presence within the same selected source record with separate presence frequencies.',[['N','Number of selected source records, not patients or independent events.'],['A and B','Both features occur in the same record. A deficiency feature comes from that row’s source tag, not a keyword match.'],['P(A and B)','Records containing both features divided by N.'],['P(A), P(B)','Records containing each feature divided by N.'],['Weights','Every record has equal weight. Source IJ does not add numerical weight.']],'Record lift');
};
const cmsSummaryBefore=renderNetworkSummary;renderNetworkSummary=function(){
 if(mode!=='phrase')return cmsSummaryBefore();const box=$('networkSummary'),g=currentGraph();box.replaceChildren(elem('h3','','Network summary'));box.dataset.records=String(g.documents);box.dataset.view=cmsView();box.dataset.nodes=String(shownNodes.length);box.dataset.edges=String(shownEdges.length);
 box.append(elem('p','summary-scope',`${count(g.hospiceTotals.count)} hospices · ${count(g.documents)} source records · ${count(shownNodes.length)} displayed nodes · ${count(shownEdges.length)} connections`));
 if(!g.documents){box.append(elem('p','','No records match these filters.'));return;}
 if(!cmsClassified()){
  const table=summaryTable('Top 5 phrases',['Phrase','Hospices (%)','Strongest partner']);table.wrap.classList.add('summary-top');
  const top=g.nodes.filter(n=>n.id<64&&n.count>0).sort((a,b)=>nodeValue(b)-nodeValue(a)||a.id-b.id).slice(0,5),edges=[...shownEdges].sort((a,b)=>b.weight-a.weight||b.shared-a.shared);
  for(const n of top){const row=elem('tr'),label=elem('td');row.dataset.node=n.id;label.append(summaryPhrase(n));row.append(label,elem('td','',`${count(n.hospice.count)} (${summaryPercentage(n.hospice.count,g.hospiceTotals.count)})`),summaryPartnerCell(n,edges,g,false,$('edgeUnit').value));table.tbody.append(row);}
  box.append(table.wrap,elem('p','','Ranked by distinct assigned hospice CCNs in the selected source cohort, independently of displayed-link thresholds.'));return;
 }
 const caption=cmsView()==='ij'?'Top 5 IJ-associated deficiencies':cmsView()==='standard'?'Top 5 standard-level deficiencies':'Top 5 condition-level deficiencies';
 const table=summaryTable(caption,['Deficiency','Cited regulation','Hospices (%)','Records']);table.wrap.classList.add('summary-top');
 for(const stat of g.tagRanking.slice(0,5)){const n=g.nodes[stat.node.id],row=elem('tr'),label=elem('td'),reg=elem('td');row.dataset.node=n.id;row.dataset.tag=n.tag;row.dataset.hospices=stat.providers.size;row.dataset.records=stat.records;label.append(summaryPhrase(n));
  const citations=new Set(g.severityRows.filter(r=>sourceTagIndex(r)===n.id-64).map(r=>CMS_DATA.citationByRow[r[0]]));
  for(const citation of citations){const section=citation.match(/418\.\d+/)?.[0];if(section){reg.append(cmsPolicyLink(citation,'https://www.ecfr.gov/current/title-42/chapter-IV/subchapter-B/part-418/section-'+section),document.createTextNode(' '));}}
  row.append(label,reg,elem('td','',`${count(stat.providers.size)} (${summaryPercentage(stat.providers.size,g.hospiceTotals.count)})`),elem('td','',count(stat.records)));table.tbody.append(row);
 }box.append(table.wrap,elem('p','','Ranked by distinct assigned hospice CCNs in the selected cohort; record counts break ties, followed by tag code. Counts describe this corpus, not patient harms or national prevalence.'));
 const basis=elem('p','','Classification basis: ');basis.append(cmsPolicyLink(...cmsClassificationPolicy()),document.createTextNode('. IJ overlaps Standard and Condition; it is not a third deficiency level.'));box.append(basis);
};
const cmsExportBefore=edgeExportTables;edgeExportTables=function(){const tables=cmsExportBefore();if(mode!=='phrase')return tables;const reports=tables[1].rows,sourceColumn=reports[0].indexOf('source_excel_row'),byRow=new Map(selectedSeverityRows().map(r=>[r[0],r]));reports[0].push('source_deficiency_level','source_IJ','source_cited_regulation');for(const row of reports.slice(1)){const r=byRow.get(row[sourceColumn]);row.push(r[7]===1?'Condition':'Standard',r[6]===1?'Yes':r[6]===2?'No':'Not recorded',CMS_DATA.citationByRow[r[0]]);}tables[2].rows.push(['classification_model',CMS_DATA.version],['CMS_view',cmsView()],['source_classification','Recorded Standard/Condition and IJ; no inferred severity score'],['target_diamonds','Top five source deficiency tags in the selected cohort; all cohort records contribute wording']);return tables;};
const cmsDomainBefore=summaryDomain;summaryDomain=function(n){return n.isDeficiency?{name:'source-cited deficiency categories',question:'what the source finding reports under the cited regulation'}:cmsDomainBefore(n);};
const cmsCompactTooltipBefore=compactNodeTooltip;compactNodeTooltip=function(n){const box=cmsCompactTooltipBefore(n);if(n.isDeficiency){const label=box.querySelector('.tooltip-label'),value=box.querySelector('.tooltip-value');if(label)label.textContent='Deficiency';if(value)value.textContent=cmsNodeName(n);const field=elem('div','tooltip-field');field.append(elem('div','tooltip-label','Deficiency tag'),elem('div','tooltip-value',cmsNodeTag(n)));box.append(field);}return box;};
const cmsSummaryPhraseBefore=summaryPhrase;summaryPhrase=function(n){const button=cmsSummaryPhraseBefore(n);if(n.isDeficiency){button.textContent=cmsNodeName(n);button.title='Deficiency tag: '+cmsNodeTag(n);}return button;};
const cmsRouteStatusBefore=careSeparationStatus;careSeparationStatus=function(base,gone,stats,manual,strategy){const status=cmsRouteStatusBefore(base,gone,stats,manual,strategy);return base.careRoute?.impossible&&strategy!=='target'?'Protected-tag separation is unreachable for these connections. Comparison playback shows network breakup. '+status:status;};
resetGuidedPreset('general',false);
