importScripts('vendor/ort/ort.webgpu.min.js');
let sess=null,ep='',cancel=false;
ort.env.wasm.wasmPaths=new URL('vendor/ort/',self.location.href).href;ort.env.wasm.numThreads=self.crossOriginIsolated?Math.min(4,navigator.hardwareConcurrency||1):1;
self.onmessage=async e=>{const m=e.data;
 if(m.cmd==='cancel'){cancel=true;return}
 try{
 if(m.cmd==='init'){if(sess){postMessage({type:'ready',ep});return}
  const eps=m.allowGpu&&self.navigator.gpu?['webgpu','wasm']:['wasm'];
  for(const p of eps){try{sess=await ort.InferenceSession.create(m.model,{executionProviders:[p],graphOptimizationLevel:'all'});ep=p;break}catch(err){if(p==='wasm')throw err}}
  postMessage({type:'ready',ep});return}
 if(m.cmd==='run'){cancel=false;const{w,h,data,tile,ov}=m,S=4,W=w*S,H=h*S,out=new Uint8ClampedArray(W*H*4);
  const tiles=[];for(let y=0;y<h;y+=tile)for(let x=0;x<w;x+=tile)tiles.push([x,y]);let done=0;const t0=performance.now();
  for(const[x,y]of tiles){if(cancel){postMessage({type:'cancelled'});return}
   const x0=Math.max(0,x-ov),y0=Math.max(0,y-ov),x1=Math.min(w,x+tile+ov),y1=Math.min(h,y+tile+ov),tw=x1-x0,th=y1-y0,inp=new Float32Array(3*tw*th);
   for(let j=0;j<th;j++)for(let i=0;i<tw;i++){const s=((y0+j)*w+x0+i)*4,d=j*tw+i;inp[d]=data[s]/255;inp[tw*th+d]=data[s+1]/255;inp[2*tw*th+d]=data[s+2]/255}
   const r=await sess.run({input:new ort.Tensor('float32',inp,[1,3,th,tw])});const o=r.output.data,OW=tw*S,OH=th*S,P=OW*OH;
   const cx0=(x-x0)*S,cy0=(y-y0)*S,cw=Math.min(tile,w-x)*S,ch=Math.min(tile,h-y)*S;
   for(let j=0;j<ch;j++){const sj=cy0+j,dy=y*S+j;for(let i=0;i<cw;i++){const si=sj*OW+cx0+i,dd=(dy*W+x*S+i)*4;out[dd]=o[si]*255;out[dd+1]=o[P+si]*255;out[dd+2]=o[2*P+si]*255;out[dd+3]=255}}
   r.output.dispose&&r.output.dispose();done++;postMessage({type:'progress',done,total:tiles.length,ms:performance.now()-t0})}
  postMessage({type:'done',W,H,data:out,ms:performance.now()-t0,ep,tiles:tiles.length},[out.buffer])}
 }catch(err){postMessage({type:'error',message:String(err&&err.message||err)})}};
