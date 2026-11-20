import {width,height,examples,depth,reference} from './model.js';
const el = id => document.getElementById(id);
const clamp = (n,limit) => Math.max(0,Math.min(limit-1,n));
let x=410, y=350, rightX=null, shown=false, map;
function select(px,py,name) {
  x=clamp(px,width); y=clamp(py,height); rightX=null; shown=false;
  for (const b of el('presets').children) b.setAttribute('aria-pressed',String(b.dataset.case===name));
  render();
}
function detail(id, px) {
  const canvas=el(id+'Zoom'), img=el(id).querySelector('img');
  const ctx=canvas.getContext('2d'), w=canvas.width, h=canvas.height;
  ctx.fillStyle='#12263e';ctx.fillRect(0,0,w,h);
  if (px===null || !img.complete || !img.naturalWidth) return;
  const zoom=4;
  ctx.imageSmoothingEnabled=false;
  ctx.drawImage(img,w/2-(px+.5)*zoom,h/2-(y+.5)*zoom,width*zoom,height*zoom);
  ctx.strokeStyle='#76ffea';ctx.lineWidth=2;ctx.beginPath();
  ctx.moveTo(w/2-11,h/2);ctx.lineTo(w/2-3,h/2);ctx.moveTo(w/2+3,h/2);ctx.lineTo(w/2+11,h/2);
  ctx.moveTo(w/2,h/2-11);ctx.lineTo(w/2,h/2-3);ctx.moveTo(w/2,h/2+3);ctx.lineTo(w/2,h/2+11);ctx.stroke();
}
function render() {
  if (!map) return;
  const ref=reference(map,x,y);
  const visible=ref.kind==='visible';
  const measured=visible && rightX!==null;
  const disparity=measured ? x-rightX : null;
  const z=measured ? depth(disparity) : null;
  const truth=visible ? depth(ref.disparity) : null;
  for (const id of ['left','right']) el(id).style.setProperty('--y',((y+.5)/height*100)+'%');
  el('left').style.setProperty('--x',((x+.5)/width*100)+'%');
  el('right').style.setProperty('--x',((rightX+.5)/width*100)+'%');
  el('right').querySelector('.point').hidden=!measured;
  el('coords').textContent=x+', '+y+' px';
  el('rightCoord').textContent=measured ? rightX.toFixed(2)+', '+y+' px' : '行 '+y;
  el('answer').hidden=!shown || !visible;
  if (visible) el('right').style.setProperty('--answer',((x-ref.disparity+.5)/width*100)+'%');
  detail('left',x);detail('right',measured ? rightX : null);
  el('reveal').disabled=!visible;
  el('reveal').textContent=shown ? '回到独立匹配' : '显示参考位置';
  el('minus').disabled=!measured || rightX<=0;
  el('plus').disabled=!measured || rightX>=width-1;
  el('d').textContent=measured ? disparity.toFixed(2)+' px' : '—';
  el('z').textContent=z===null ? '—' : z.toFixed(3)+' m';
  el('truth').textContent=visible && (measured || shown) ? truth.toFixed(3)+' m' : '—';
  el('err').textContent=z===null ? '—' : ((z-truth)*100).toFixed(1)+' cm';
  el('status').textContent=ref.kind==='unknown' ? '这个像素缺少参考视差。请在左图换一个点。' : !visible ? '遮挡：该点只在左相机可见，右图没有可核对的对应点。试试它旁边的像素。' : shown ? '黄色方框是参考位置。左右微调一个像素，比较近景与远景的深度偏差。' : !measured ? '沿右图虚线点击你认为相同的细节，或用回车开始键盘匹配。' : z===null ? '这次匹配产生了非正的校正视差，无法恢复正深度。请调整右图位置。' : '已测量。可以逐像素微调，或显示参考位置再比较。';
}
function adjust(dx) {
  if (!map || reference(map,x,y).kind!=='visible') return;
  rightX=clamp((rightX??x)+dx,width);render();
}
for (const key of ['left','right']) {
  const plane=el(key);
  plane.querySelector('img').addEventListener('load',render);
  plane.addEventListener('click',event=>{
    if (!map) return;
    const bounds=plane.getBoundingClientRect();
    const px=clamp(Math.floor((event.clientX-bounds.left)/bounds.width*width),width);
    if (key==='left') select(px,Math.floor((event.clientY-bounds.top)/bounds.height*height));
    else if (reference(map,x,y).kind==='visible') {rightX=px;render();}
  });
  plane.addEventListener('keydown',event=>{
    const offsets={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
    const offset=offsets[event.key];
    if (key==='right' && event.key==='Enter') {event.preventDefault();adjust(0);return;}
    if (!map || !offset || (key==='right' && offset[1])) return;
    event.preventDefault();
    if (key==='left') select(x+offset[0],y+offset[1]); else adjust(offset[0]);
  });
}
el('presets').addEventListener('click',e=>{const name=e.target.dataset.case;if (name) select(...examples[name],name);});
el('reveal').onclick=()=>{
  const ref=reference(map,x,y);
  if (shown) {rightX=null;shown=false;}
  else {if (rightX===null) rightX=x-ref.disparity;shown=true;}
  render();
};
el('minus').onclick=()=>adjust(-1);
el('plus').onclick=()=>adjust(1);
try {
  const res=await fetch('data/reference.bin');
  if (!res.ok) throw Error();
  map=new DataView(await res.arrayBuffer());
  if (map.byteLength!==2*width*height) throw Error();
  render();
} catch { map=null;el('status').textContent='参考视差加载失败，请刷新本页重试。'; }
