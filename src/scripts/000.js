/* Shared QCOR presentation palette: Paul Tol Muted. */
window.QCOR_PALETTE=Object.freeze({
 name:'Paul Tol Muted',colors:Object.freeze(["#332288", "#44AA99", "#CC6677", "#DDCC77", "#117733", "#88CCEE", "#882255", "#999933", "#AA4499"]),neutral:'#AEB8BE',
 category(i){return this.colors[((i%this.colors.length)+this.colors.length)%this.colors.length];},
 cluster(i){return i<0?this.neutral:this.category(i);},
 careGroup(i){return i>=8?this.neutral:this.category(i);},
 text(hex){const c=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4),l=.2126*c[0]+.7152*c[1]+.0722*c[2];return (l+.05)/.05>=1.05/(l+.05)?'#000000':'#FFFFFF';}
});