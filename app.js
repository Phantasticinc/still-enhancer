'use strict';
const $=id=>document.getElementById(id);
let origFile=null,origBytes=null,origHash='',origImg=null,loadedAt='',busy=false,pending=false;
const ctl=['rot','frot','cl','cr','ct','cb','scale','method','bri','con','gam','lb','lw','gray','heq','dn','usa','usr','wbr','wbg','wbb','clahe','rlo','rhi','glo','ghi','blo','bhi'];
const defaults={};ctl.forEach(k=>{const e=$(k);defaults[k]=e.type==='checkbox'?e.checked:(isNaN(+e.value)?e.value:+e.value)});
const params=()=>{const p={};ctl.forEach(k=>{const e=$(k);p[k]=e.type==='checkbox'?e.checked:(isNaN(+e.value)?e.value:+e.value)});return p};
document.querySelectorAll('input[type=range]').forEach(r=>{const s=r.nextElementSibling;const u=()=>{if(s&&s.tagName==='SPAN')s.textContent=r.value};r.addEventListener('input',u);u()});
async function sha256(buf){const h=await crypto.subtle.digest('SHA-256',buf);return[...new Uint8Array(h)].map(b=>b.toString(16).padStart(2,'0')).join('')}
const items=[];let cur=-1;
const IF=['addr','lat','lng','dt','cam','clothing','vehicle','plate','marks','dir','tags','notes'];
function use(it){origFile=it.file;origBytes=it.bytes;origHash=it.hash;origImg=it.img;loadedAt=it.loadedAt}
$('file').addEventListener('change',async e=>{for(const f of e.target.files){const bytes=new Uint8Array(await f.arrayBuffer());
  const it={id:items.length+1,file:f,bytes,hash:await sha256(bytes),img:await createImageBitmap(new Blob([bytes],{type:f.type}),{imageOrientation:'from-image'}),loadedAt:new Date().toISOString(),params:{...defaults},meta:{}};
  IF.forEach(k=>it.meta[k]='');items.push(it)}e.target.value='';select(items.length-1)});
const label=(it,i)=>`#${i+1} ${it.file.name}${it.meta.dt?' · '+it.meta.dt.replace('T',' '):''}`;
function select(i){cur=i;$('export').disabled=!items.length;const it=items[i];
  if(!it){origImg=null;$('hash').textContent='No image loaded';$('dims').textContent='';refreshBoard();return}use(it);
  ctl.forEach(k=>{const e=$(k);if(e.type==='checkbox')e.checked=it.params[k];else e.value=it.params[k];const sp=e.nextElementSibling;if(sp&&sp.tagName==='SPAN')sp.textContent=e.value});
  IF.forEach(k=>$('i_'+k).value=it.meta[k]);
  $('hash').textContent='SHA-256: '+origHash;$('dims').textContent=`${origFile.name} · ${origImg.width}×${origImg.height} · ${origFile.size} bytes · loaded ${loadedAt}`;refreshBoard();render()}
IF.forEach(k=>$('i_'+k).addEventListener('input',()=>{if(items[cur]){items[cur].meta[k]=$('i_'+k).value;refreshBoard(k!=='notes')}}));
ctl.forEach(k=>$(k).addEventListener('input',()=>{if(items[cur])items[cur].params=params()}));
$('cur').onchange=()=>select(+$('cur').value);
$('removeItem').onclick=()=>{if(cur<0)return;items.splice(cur,1);select(Math.min(cur,items.length-1))};
function sorted(){const k=$('sortBy').value,m={dt:'dt',cam:'cam',addr:'addr'}[k];const l=items.map((it,i)=>({it,i}));
  if(m)l.sort((x,y)=>(x.it.meta[m]||'\uffff').localeCompare(y.it.meta[m]||'\uffff'));return l}
const tagStr=m=>['clothing','vehicle','plate','marks','dir','tags'].filter(k=>m[k]).map(k=>k+': '+m[k]).join('; ');
let map,layer,lastMapKey='';
function refreshBoard(full=true){const opts=items.map((it,i)=>`<option value="${i}">${esc(label(it,i))}</option>`).join('');
  for(const id of['cur','cmpA','cmpB']){const e=$(id),v=e.value;e.innerHTML=opts;e.value=id==='cur'?cur:(v!==''&&+v<items.length?v:(id==='cmpB'?Math.min(1,items.length-1):0))}
  $('timeline').innerHTML='<tr><th>#</th><th>Date/time</th><th>Location</th><th>Camera</th><th>Tags</th><th>SHA-256 (orig)</th></tr>'+sorted().map(({it,i})=>
   `<tr data-i="${i}" style="cursor:pointer;border-top:1px solid #333${i===cur?';background:#24364a':''}"><td>${i+1}</td><td>${esc(it.meta.dt.replace('T',' '))}</td><td>${esc(it.meta.addr)}${it.meta.lat?` (${esc(it.meta.lat)}, ${esc(it.meta.lng)})`:''}</td><td>${esc(it.meta.cam)}</td><td>${esc(tagStr(it.meta))}</td><td style="font-family:monospace;font-size:10px">${it.hash.slice(0,16)}…</td></tr>`).join('');
  $('timeline').querySelectorAll('tr[data-i]').forEach(r=>r.onclick=()=>select(+r.dataset.i));
  if(full){drawMap();drawCompare()}}
$('sortBy').onchange=()=>refreshBoard();$('cmpA').onchange=$('cmpB').onchange=drawCompare;$('onlineTiles').onchange=()=>{lastMapKey='';drawMap()};
const pts=()=>items.map((it,i)=>({i,lat:parseFloat(it.meta.lat),lng:parseFloat(it.meta.lng),it})).filter(p=>isFinite(p.lat)&&isFinite(p.lng)).sort((a,b)=>(a.it.meta.dt||'').localeCompare(b.it.meta.dt||''));
function svgPlot(ps,w=600,h=320){if(!ps.length)return`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="60"><text x="10" y="30" fill="#999">No stills with lat/lng yet.</text></svg>`;
  const la=ps.map(p=>p.lat),ln=ps.map(p=>p.lng),pad=.0005,y0=Math.min(...la)-pad,y1=Math.max(...la)+pad,x0=Math.min(...ln)-pad,x1=Math.max(...ln)+pad;
  const X=v=>30+(v-x0)/(x1-x0)*(w-60),Y=v=>h-30-(v-y0)/(y1-y0)*(h-60);
  return`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" style="background:#f4f4f4"><text x="6" y="14" font-size="11" fill="#555">Offline plot (not to scale, north up) · lat ${y0.toFixed(5)}–${y1.toFixed(5)}, lng ${x0.toFixed(5)}–${x1.toFixed(5)}</text>
<polyline fill="none" stroke="#69c" stroke-dasharray="4 3" points="${ps.map(p=>X(p.lng)+','+Y(p.lat)).join(' ')}"/>${ps.map(p=>`<circle cx="${X(p.lng)}" cy="${Y(p.lat)}" r="9" fill="#c33"/><text x="${X(p.lng)}" y="${Y(p.lat)+4}" font-size="11" fill="#fff" text-anchor="middle">${p.i+1}</text><text x="${X(p.lng)+12}" y="${Y(p.lat)-8}" font-size="10" fill="#333">${esc((p.it.meta.dt||'').replace('T',' '))} ${esc(p.it.meta.cam)}</text>`).join('')}</svg>`}
function drawMap(){const ps=pts(),key=JSON.stringify([$('onlineTiles').checked,ps.map(p=>[p.i,p.lat,p.lng,p.it.meta.dt,p.it.meta.cam])]);if(key===lastMapKey)return;lastMapKey=key;
  if(map){map.remove();map=null}const el=$('map');el.innerHTML='';
  if(!$('onlineTiles').checked||!window.L||!navigator.onLine){el.style.height='auto';el.innerHTML=svgPlot(ps);return}
  el.style.height='320px';map=L.map(el);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
  L.Icon.Default.imagePath='vendor/images/';if(!ps.length){map.setView([39,-98],3);return}
  ps.forEach(p=>L.marker([p.lat,p.lng]).addTo(map).bindTooltip(`#${p.i+1} ${(p.it.meta.dt||'').replace('T',' ')} ${p.it.meta.cam}`,{permanent:true}));
  if(ps.length>1)L.polyline(ps.map(p=>[p.lat,p.lng]),{dashArray:'4 4'}).addTo(map);map.fitBounds(L.latLngBounds(ps.map(p=>[p.lat,p.lng])).pad(.3),{maxZoom:18})}
function drawCompare(){for(const[s,c,inf]of[['cmpA','cA','cAi'],['cmpB','cB','cBi']]){const it=items[+$(s).value],e=$(c);if(!it){e.width=0;$(inf).textContent='';continue}
  const save=[origFile,origBytes,origHash,origImg,loadedAt];use(it);const{after}=process(it.params);[origFile,origBytes,origHash,origImg,loadedAt]=save;
  e.width=after.width;e.height=after.height;e.getContext('2d').drawImage(after,0,0);$(inf).textContent=`${label(it,+$(s).value)} — ${it.meta.addr} ${it.meta.cam} — ${tagStr(it.meta)}`}}
ctl.forEach(k=>$(k).addEventListener('input',render));
$('reset').onclick=()=>{ctl.forEach(k=>{const e=$(k);if(e.type==='checkbox')e.checked=defaults[k];else e.value=defaults[k];e.dispatchEvent(new Event('input'))})};
function setSplit(v){v=Math.max(0,Math.min(100,v));$('slider').value=v;$('before').style.clipPath=`inset(0 ${100-v}% 0 0)`;$('divider').style.left=v+'%'}
$('slider').addEventListener('input',()=>setSplit(+$('slider').value));
{const c=$('cmp');let drag=false;const mv=e=>{const r=c.getBoundingClientRect();setSplit((e.clientX-r.left)/r.width*100)};
 c.addEventListener('pointerdown',e=>{drag=true;c.setPointerCapture(e.pointerId);mv(e)});c.addEventListener('pointermove',e=>{if(drag)mv(e)});
 c.addEventListener('pointerup',()=>drag=false);
 c.addEventListener('touchstart',e=>{mv(e.touches[0])},{passive:true});c.addEventListener('touchmove',e=>{const t=e.touches[0];mv(t)},{passive:true});c.addEventListener('pointercancel',()=>drag=false)}
function cv(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c}
function geometry(p){const r=p.rot*Math.PI/180+p.frot*Math.PI/180,W=origImg.width,H=origImg.height;
 const cw=Math.round(Math.abs(W*Math.cos(r))+Math.abs(H*Math.sin(r))),ch=Math.round(Math.abs(W*Math.sin(r))+Math.abs(H*Math.cos(r)));
 const c=cv(cw,ch),x=c.getContext('2d');x.imageSmoothingQuality='high';x.translate(cw/2,ch/2);x.rotate(r);x.drawImage(origImg,-W/2,-H/2);
 const sx=Math.round(cw*p.cl/100),sy=Math.round(ch*p.ct/100),sw=Math.max(1,cw-sx-Math.round(cw*p.cr/100)),sh=Math.max(1,ch-sy-Math.round(ch*p.cb/100));
 const o=cv(sw,sh);o.getContext('2d').drawImage(c,sx,sy,sw,sh,0,0,sw,sh);return o}
function lanczos(src,f){const sw=src.width,sh=src.height,dw=sw*f,dh=sh*f,a=3,s=src.getContext('2d').getImageData(0,0,sw,sh).data;
 const L=x=>x===0?1:Math.abs(x)>=a?0:a*Math.sin(Math.PI*x)*Math.sin(Math.PI*x/a)/(Math.PI*Math.PI*x*x);
 const pass=(inp,iw,ih,ow,horiz)=>{const n=horiz?ow:ih*0+ow,out=new Float32Array((horiz?ow*ih:iw*ow)*4);const len=horiz?iw:ih;
  const ws=[];for(let o=0;o<n;o++){const c=(o+.5)/f-.5,lo=Math.floor(c)-a+1,w=[];let t=0;for(let k=lo;k<lo+2*a;k++){const v=L(c-k);w.push([Math.min(len-1,Math.max(0,k)),v]);t+=v}ws.push(w.map(([k,v])=>[k,v/t]))}
  if(horiz){for(let y=0;y<ih;y++)for(let o=0;o<ow;o++){const d=(y*ow+o)*4;for(const[k,v]of ws[o]){const q=(y*iw+k)*4;for(let ch=0;ch<4;ch++)out[d+ch]+=inp[q+ch]*v}}}
  else{for(let o=0;o<ow;o++)for(let x=0;x<iw;x++){const d=(o*iw+x)*4;for(const[k,v]of ws[o]){const q=(k*iw+x)*4;for(let ch=0;ch<4;ch++)out[d+ch]+=inp[q+ch]*v}}}return out};
 const h=pass(s,sw,sh,dw,true),v=pass(h,dw,sh,dh,false);const c=cv(dw,dh),x=c.getContext('2d'),id=x.createImageData(dw,dh);
 for(let i=0;i<v.length;i++)id.data[i]=v[i];x.putImageData(id,0,0);return c}
function upscale(src,p){if(p.scale===1)return src;if(p.method==='lanczos')return lanczos(src,p.scale);
 const c=cv(src.width*p.scale,src.height*p.scale),x=c.getContext('2d');x.imageSmoothingEnabled=p.method!=='nearest';x.imageSmoothingQuality='high';x.drawImage(src,0,0,c.width,c.height);return c}
function median(d,w,h,r){if(!r)return;const s=new Uint8ClampedArray(d),a=[];for(let y=0;y<h;y++)for(let x=0;x<w;x++)for(let ch=0;ch<3;ch++){a.length=0;
 for(let j=-r;j<=r;j++)for(let i=-r;i<=r;i++){const yy=Math.min(h-1,Math.max(0,y+j)),xx=Math.min(w-1,Math.max(0,x+i));a.push(s[(yy*w+xx)*4+ch])}a.sort((m,n)=>m-n);d[(y*w+x)*4+ch]=a[a.length>>1]}}
function chan(d,p){const L=[[p.rlo,p.rhi,p.wbr],[p.glo,p.ghi,p.wbg],[p.blo,p.bhi,p.wbb]].map(([lo,hi,g])=>{const t=new Uint8ClampedArray(256);for(let i=0;i<256;i++)t[i]=(i-lo)/Math.max(1,hi-lo)*255*g;return t});
 if(L.every((t,c)=>t.every((v,i)=>v===i)))return;for(let i=0;i<d.length;i+=4){d[i]=L[0][d[i]];d[i+1]=L[1][d[i+1]];d[i+2]=L[2][d[i+2]]}}
function clahe(d,w,h,amt){if(!amt)return;const T=8,tw=Math.ceil(w/T),th=Math.ceil(h/T),n=w*h,Y=new Uint8Array(n);for(let i=0;i<n;i++)Y[i]=.299*d[i*4]+.587*d[i*4+1]+.114*d[i*4+2];
 const maps=[];for(let ty=0;ty<T;ty++)for(let tx=0;tx<T;tx++){const hist=new Float32Array(256);let cnt=0;for(let y=ty*th;y<Math.min(h,(ty+1)*th);y++)for(let x=tx*tw;x<Math.min(w,(tx+1)*tw);x++){hist[Y[y*w+x]]++;cnt++}
  const lim=Math.max(1,(1+amt)*cnt/256);let ex=0;for(let i=0;i<256;i++)if(hist[i]>lim){ex+=hist[i]-lim;hist[i]=lim}const add=ex/256;const m=new Float32Array(256);let t=0;for(let i=0;i<256;i++){t+=hist[i]+add;m[i]=t/Math.max(1,cnt)*255}maps.push(m)}
 const blend=Math.min(1,amt/2);for(let y=0;y<h;y++){const fy=Math.min(T-1,Math.max(0,(y+.5)/th-.5)),y0=Math.floor(fy),y1=Math.min(T-1,y0+1),ay=fy-y0;
  for(let x=0;x<w;x++){const fx=Math.min(T-1,Math.max(0,(x+.5)/tw-.5)),x0=Math.floor(fx),x1=Math.min(T-1,x0+1),ax=fx-x0,v=Y[y*w+x];
   const ny=(maps[y0*T+x0][v]*(1-ax)+maps[y0*T+x1][v]*ax)*(1-ay)+(maps[y1*T+x0][v]*(1-ax)+maps[y1*T+x1][v]*ax)*ay,o=v*(1-blend)+ny*blend,k=(o+1)/(v+1),i=(y*w+x)*4;
   d[i]*=k;d[i+1]*=k;d[i+2]*=k}}}
function tone(d,p){const lut=new Uint8ClampedArray(256),cf=(259*(p.con*1.275+255))/(255*(259-p.con*1.275));
 for(let i=0;i<256;i++){let v=Math.min(1,Math.max(0,(i-p.lb)/Math.max(1,p.lw-p.lb)));v=Math.pow(v,1/p.gam)*255;v=cf*(v-128)+128+p.bri*1.275;lut[i]=v}
 for(let i=0;i<d.length;i+=4){for(let c=0;c<3;c++)d[i+c]=lut[d[i+c]];if(p.gray){const g=.299*d[i]+.587*d[i+1]+.114*d[i+2];d[i]=d[i+1]=d[i+2]=g}}
 if(p.heq){const hist=new Array(256).fill(0),n=d.length/4,Y=new Float32Array(n);for(let i=0;i<n;i++){Y[i]=.299*d[i*4]+.587*d[i*4+1]+.114*d[i*4+2];hist[Y[i]|0]++}
  const cdf=[];let t=0;for(let i=0;i<256;i++){t+=hist[i];cdf[i]=t}const mn=cdf.find(v=>v>0);
  for(let i=0;i<n;i++){const y=Y[i]|0,ny=(cdf[y]-mn)/Math.max(1,n-mn)*255,k=y?ny/y:0;for(let c=0;c<3;c++)d[i*4+c]=y?d[i*4+c]*k:ny}}}
function boxBlur(s,w,h,r){const o=new Float32Array(s.length),t=new Float32Array(s.length);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)for(let c=0;c<3;c++){let a=0,n=0;for(let i=-r;i<=r;i++){const xx=x+i;if(xx>=0&&xx<w){a+=s[(y*w+xx)*4+c];n++}}t[(y*w+x)*4+c]=a/n}
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)for(let c=0;c<3;c++){let a=0,n=0;for(let j=-r;j<=r;j++){const yy=y+j;if(yy>=0&&yy<h){a+=t[(yy*w+x)*4+c];n++}}o[(y*w+x)*4+c]=a/n}return o}
function unsharp(d,w,h,amt,r){if(!amt)return;const b=boxBlur(boxBlur(d,w,h,r).map(v=>v),w,h,r);for(let i=0;i<d.length;i++)if(i%4!==3)d[i]=d[i]+amt*(d[i]-b[i])}
const MAX_AREA=16e6,PREVIEW=1400;
function process(p,preview){let g=geometry(p),scale=p.scale,note='';
 if(preview){const lim=PREVIEW/scale,k=Math.min(1,lim/Math.max(g.width,g.height));if(k<1){const c=cv(Math.max(1,Math.round(g.width*k)),Math.max(1,Math.round(g.height*k)));const x=c.getContext('2d');x.imageSmoothingQuality='high';x.drawImage(g,0,0,c.width,c.height);g=c}}
 else while(scale>1&&g.width*g.height*scale*scale>MAX_AREA){scale/=2;note=`Upscale reduced from ${p.scale}x to ${scale}x: output would exceed ${MAX_AREA/1e6} MP canvas limit on mobile.`}
 if(!preview&&g.width*g.height>MAX_AREA)note='Image exceeds mobile canvas limit; output may fail.';
 const pp={...p,scale},before=upscale(g,pp),after=cv(before.width,before.height),x=after.getContext('2d');x.drawImage(before,0,0);
 const W=after.width,H=after.height,id=x.getImageData(0,0,W,H),d=id.data;median(d,W,H,p.dn);chan(d,p);tone(d,p);clahe(d,W,H,p.clahe);unsharp(d,W,H,p.usa,p.usr);x.putImageData(id,0,0);return{before,after,note,scale}}
let rt;function render(){clearTimeout(rt);rt=setTimeout(doRender,120)}
function doRender(){if(!origImg)return;if(busy){pending=true;return}busy=true;$('status').textContent='Processing…';
 setTimeout(()=>{try{const t=performance.now(),{before,after}=process(params(),true);for(const[id,c]of[['before',before],['after',after]]){const e=$(id);e.width=c.width;e.height=c.height;e.getContext('2d').drawImage(c,0,0)}
  window.__renders=(window.__renders||0)+1;$('status').textContent=`Preview ${after.width}×${after.height} (full resolution on export) · ${Math.round(performance.now()-t)} ms`}
  catch(err){$('status').textContent='Error: '+err.message}busy=false;if(pending){pending=false;doRender()}},30)}
function autoEnhance(){if(!origImg)return;const g0=geometry(params()),k=Math.min(1,600/Math.max(g0.width,g0.height)),g=cv(Math.max(1,g0.width*k|0),Math.max(1,g0.height*k|0));g.getContext('2d').drawImage(g0,0,0,g.width,g.height);
 const d=g.getContext('2d').getImageData(0,0,g.width,g.height).data,n=d.length/4,lv=[];
 for(let c=0;c<3;c++){const h=new Array(256).fill(0);for(let i=c;i<d.length;i+=4)h[d[i]]++;let t=0,lo=0,hi=255;for(let i=0;i<256;i++){t+=h[i];if(t<=n*.005)lo=i}t=0;for(let i=255;i>=0;i--){t+=h[i];if(t<=n*.005)hi=i}if(hi-lo<10){lo=0;hi=255}lv.push([lo,hi])}
 const m=[0,0,0];for(let i=0;i<d.length;i+=4)for(let c=0;c<3;c++)m[c]+=Math.min(255,Math.max(0,(d[i+c]-lv[c][0])/(lv[c][1]-lv[c][0])*255));for(let c=0;c<3;c++)m[c]/=n;
 const avg=(m[0]+m[1]+m[2])/3,gain=m.map(v=>Math.min(2,Math.max(.5,avg/Math.max(1,v))));const lum=Math.min(.95,Math.max(.02,(.299*m[0]*gain[0]+.587*m[1]*gain[1]+.114*m[2]*gain[2])/255));
 const gam=Math.min(3,Math.max(.4,Math.log(lum)/Math.log(.45))),dark=lum<.35;
 const v={rlo:lv[0][0],rhi:lv[0][1],glo:lv[1][0],ghi:lv[1][1],blo:lv[2][0],bhi:lv[2][1],wbr:gain[0].toFixed(2),wbg:gain[1].toFixed(2),wbb:gain[2].toFixed(2),gam:gam.toFixed(2),clahe:dark?2:.8,dn:1,usa:.8,usr:1,lb:0,lw:255,bri:0,con:0,heq:false};
 for(const[k2,val]of Object.entries(v)){const e=$(k2);if(e.type==='checkbox')e.checked=val;else e.value=val;const sp=e.nextElementSibling;if(sp&&sp.tagName==='SPAN')sp.textContent=e.value}
 if(items[cur]){items[cur].params=params();items[cur].auto={applied_at:new Date().toISOString(),values:v}}
 $('autoNote').textContent=`Auto: levels per channel (0.5% clip), gray-world WB, gamma ${v.gam}${dark?', dark frame → strong local contrast':''}, light denoise + sharpen. All values set on the sliders below.`;render()}
$('autoBtn').onclick=autoEnhance;

// minimal ZIP (store)
const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c}return t})();
const crc32=b=>{let c=~0;for(let i=0;i<b.length;i++)c=CRC[(c^b[i])&255]^(c>>>8);return(~c)>>>0};
function zip(files){const enc=new TextEncoder(),parts=[],cen=[];let off=0;const d=new Date(),dt=((d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()>>1)),dd=(((d.getFullYear()-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate());
 for(const f of files){const nm=enc.encode(f.name),c=crc32(f.data),h=new DataView(new ArrayBuffer(30));
  [[0,0x04034b50,4],[4,20,2],[6,0x0800,2],[8,0,2],[10,dt,2],[12,dd,2],[14,c,4],[18,f.data.length,4],[22,f.data.length,4],[26,nm.length,2],[28,0,2]].forEach(([o,v,s])=>s===4?h.setUint32(o,v,true):h.setUint16(o,v,true));
  parts.push(new Uint8Array(h.buffer),nm,f.data);const ce=new DataView(new ArrayBuffer(46));
  [[0,0x02014b50,4],[4,20,2],[6,20,2],[8,0x0800,2],[10,0,2],[12,dt,2],[14,dd,2],[16,c,4],[20,f.data.length,4],[24,f.data.length,4],[28,nm.length,2],[42,off,4]].forEach(([o,v,s])=>s===4?ce.setUint32(o,v,true):ce.setUint16(o,v,true));
  cen.push(new Uint8Array(ce.buffer),nm);off+=30+nm.length+f.data.length}
 const cs=cen.reduce((a,b)=>a+b.length,0),e=new DataView(new ArrayBuffer(22));e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,cs,true);e.setUint32(16,off,true);
 return new Blob([...parts,...cen,new Uint8Array(e.buffer)],{type:'application/zip'})}
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
async function itemExport(it,n,dir){use(it);const p=it.params,{after,note,scale}=process(p,false);const png=new Uint8Array(await(await new Promise(r=>after.toBlob(r,'image/png'))).arrayBuffer());
 const enhHash=await sha256(png),ext=(it.file.name.match(/\.[^.]+$/)||[''])[0];
 const log={still_number:n,observation:{...it.meta},
  original:{filename:it.file.name,stored_as:dir+'original'+ext,size_bytes:it.bytes.length,mime:it.file.type,width:it.img.width,height:it.img.height,last_modified:new Date(it.file.lastModified).toISOString(),loaded_at:it.loadedAt,sha256:it.hash},
  enhanced:{stored_as:dir+'enhanced.png',width:after.width,height:after.height,size_bytes:png.length,sha256:enhHash},processing_order:ORDER,adjustments:p,effective_scale:scale,size_note:note||null,auto_enhance:it.auto||null};
 return{log,files:[{name:dir+'original'+ext,data:it.bytes},{name:dir+'enhanced.png',data:png},{name:dir+'log.json',data:new TextEncoder().encode(JSON.stringify(log,null,2))}],png}}
const ORDER=['rotate/crop','upscale','median denoise','per-channel levels','white balance gains','levels','gamma','contrast','brightness','grayscale','histogram equalize','CLAHE local contrast','unsharp mask'];
const DISC='Enhanced images are derivatives for viewing only. Interpolation (upscaling) does not recover information absent from the original. Originals are preserved unaltered; verify with SHA-256. Observation tags are examiner annotations, not automated identification.';
async function buildExport(){const save=cur,now=new Date().toISOString(),enc=new TextEncoder(),files=[],stills=[],imgs=[];
 const meta={case_number:$('m_case').value,examiner:$('m_exam').value,notes:$('m_notes').value};
 for(let i=0;i<items.length;i++){const dir=`still-${String(i+1).padStart(2,'0')}/`,r=await itemExport(items[i],i+1,dir);files.push(...r.files);stills.push(r.log);
  imgs.push('data:image/png;base64,'+btoa(Array.from(r.png,c=>String.fromCharCode(c)).join('')))}
 if(items[save])use(items[save]);
 const tl=items.map((it,i)=>i).sort((a,b)=>(items[a].meta.dt||'\uffff').localeCompare(items[b].meta.dt||'\uffff'));
 const log={tool:'Still Enhancer (client-side, offline)',version:2,exported_at:now,user_agent:navigator.userAgent,case:meta,timeline_order:tl.map(i=>i+1),stills,disclaimer:DISC};
 const rows=o=>Object.entries(o).map(([k,v])=>`<tr><th>${esc(k)}</th><td>${esc(typeof v==='object'?JSON.stringify(v):v)}</td></tr>`).join('');
 const html=`<!doctype html><meta charset="utf-8"><title>Case board ${esc(meta.case_number)}</title><style>body{font:13px sans-serif;max-width:900px;margin:auto}th{text-align:left;padding-right:12px;vertical-align:top}td{word-break:break-all}table{border-collapse:collapse;margin-bottom:14px;width:100%}tr{border-bottom:1px solid #ddd}.s{page-break-inside:avoid;border-top:2px solid #333;margin-top:16px}img{max-width:100%;max-height:360px}</style>
<h1>Case Board &amp; Enhancement Log</h1><p>Exported ${esc(now)}</p><table>${rows(meta)}</table>
<h2>Timeline</h2><table><tr><th>#</th><th>Date/time</th><th>Location</th><th>Camera</th><th>Tags</th></tr>${tl.map(i=>{const m=items[i].meta;return`<tr><td>${i+1}</td><td>${esc(m.dt.replace('T',' '))}</td><td>${esc(m.addr)} ${m.lat?esc(m.lat+', '+m.lng):''}</td><td>${esc(m.cam)}</td><td>${esc(tagStr(m))}</td></tr>`}).join('')}</table>
<h2>Sightings plot</h2>${svgPlot(pts())}
${stills.map((l,i)=>`<div class="s"><h2>Still #${i+1}</h2><img src="${imgs[i]}" alt="enhanced still ${i+1}"><h3>Observation</h3><table>${rows(l.observation)}</table><h3>Original (unaltered)</h3><table>${rows(l.original)}</table><h3>Enhanced</h3><table>${rows(l.enhanced)}</table><h3>Adjustments (${esc(ORDER.join(' → '))})</h3><table>${rows(l.adjustments)}</table></div>`).join('')}
<p><b>Disclaimer:</b> ${esc(DISC)}</p><p>Examiner signature: ____________________ Date: __________</p>`;
 files.push({name:'case.json',data:enc.encode(JSON.stringify(log,null,2))},{name:'case.html',data:enc.encode(html)},{name:'timeline.csv',data:enc.encode('still,datetime,address,lat,lng,camera,clothing,vehicle,plate,marks,direction,tags\n'+tl.map(i=>{const m=items[i].meta;return[i+1,m.dt,m.addr,m.lat,m.lng,m.cam,m.clothing,m.vehicle,m.plate,m.marks,m.dir,m.tags].map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')}).join('\n'))});
 return{blob:zip(files),log}}
$('export').onclick=async()=>{$('status').textContent='Exporting…';const{blob,log}=await buildExport();const a=document.createElement('a');
 a.href=URL.createObjectURL(blob);a.download=`case-${(log.case.case_number||'nocase').replace(/[^\w-]/g,'_')}-${log.exported_at.replace(/[:.]/g,'-')}.zip`;a.click();$('status').textContent='Exported '+a.download};
window.__buildExport=buildExport;
let dp;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();dp=e;if(!matchMedia('(display-mode: standalone)').matches)$('installBtn').hidden=false});
$('installBtn').onclick=async()=>{if(!dp)return;dp.prompt();const r=await dp.userChoice;if(r.outcome==='accepted')$('installBtn').hidden=true;dp=null};
window.addEventListener('appinstalled',()=>$('installBtn').hidden=true);
if('serviceWorker'in navigator){const show=w=>{$('updateBar').hidden=false;$('updateBtn').onclick=()=>w.postMessage('skip')};
 navigator.serviceWorker.register('sw.js').then(r=>{if(r.waiting&&navigator.serviceWorker.controller)show(r.waiting);
  r.addEventListener('updatefound',()=>{const w=r.installing;w.addEventListener('statechange',()=>{if(w.state==='installed'&&navigator.serviceWorker.controller)show(w)})});setInterval(()=>r.update(),3600e3)});
 let rl=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!rl&&$('updateBar').hidden===false){rl=true;location.reload()}})}
