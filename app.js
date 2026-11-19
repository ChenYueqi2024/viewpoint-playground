import {project, observe, experiment, normalPairs, CX, SENSOR_WIDTH} from './geometry.js';

const defaults = {baseline:0.6, z:8, x:0, focal:700, sigma:1};
const state = {...defaults};
let seed = 2026, challenge = false, curve = [], current, stats;
const $ = id => document.getElementById(id);
const units = {baseline:'m', z:'m', x:'m', focal:'px', sigma:'px'};
const colors = {blue:'#8faeff', yellow:'#ffdc77', muted:'#a8b9d3', white:'#edf4ff'};

function surface(id) {
  const canvas = $(id), rect = canvas.getBoundingClientRect(), ratio = devicePixelRatio || 1;
  canvas.width = Math.round(rect.width * ratio); canvas.height = Math.round(rect.height * ratio);
  const ctx = canvas.getContext('2d'); ctx.scale(ratio,ratio);
  return {ctx,w:rect.width,h:rect.height};
}
function line(ctx,a,b,color,width=1,dash=[]) {ctx.beginPath();ctx.setLineDash(dash);ctx.moveTo(...a);ctx.lineTo(...b);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();ctx.setLineDash([]);}
function dot(ctx,x,y,r,color) {ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();}
function world(w,h,x,z) {return [30+(x+4)/8*(w-60),h-45-z/16*(h-75)];}
function drawScene() {
  const {ctx,w,h}=surface('scene'); ctx.font='12px "Segoe UI", sans-serif';
  for(let x=-4;x<=4;x++)line(ctx,world(w,h,x,0),world(w,h,x,16),'#293c59');
  for(let z=0;z<=16;z+=2){line(ctx,world(w,h,-4,z),world(w,h,4,z),'#293c59');ctx.fillStyle=colors.muted;ctx.fillText(`${z}m`,4,world(w,h,0,z)[1]+4);}
  const truePoint=world(w,h,state.x,state.z);
  for(const [side,position,u] of [['左',-state.baseline/2,current.measured.left],['右',state.baseline/2,current.measured.right]]) {
    const camera=world(w,h,position,0), slope=(u-CX)/state.focal;
    ctx.save();ctx.beginPath();ctx.rect(30,20,w-60,h-45);ctx.clip();
    line(ctx,camera,world(w,h,position+slope*16,16),colors.blue,2);
    line(ctx,camera,truePoint,'#aa945e',1,[4,5]);ctx.restore();
    ctx.fillStyle='#507eea';ctx.fillRect(camera[0]-10,camera[1]-8,20,16);
    ctx.fillStyle=colors.white;ctx.textAlign='center';ctx.fillText(side,camera[0]+(side==='左'?-7:7),camera[1]+27);ctx.textAlign='left';
  }
  dot(ctx,...truePoint,8,colors.yellow);
  ctx.fillStyle=colors.yellow;ctx.fillText('目标',Math.min(truePoint[0]+13,w-38),truePoint[1]-9);
  const estimate=current.estimate;
  if(estimate && estimate.z<=16 && Math.abs(estimate.x)<=4){const [x,y]=world(w,h,estimate.x,estimate.z);ctx.save();ctx.translate(x,y);ctx.rotate(Math.PI/4);ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.strokeRect(-5,-5,10,10);ctx.restore();}
  ctx.fillStyle=colors.muted;ctx.fillText('X 横向 / Z 向前 · 俯视示意',38,22);
}
function drawSensor(side) {
  const {ctx,w}=surface(side+'-sensor'), y=43, pos=u=>12+u/SENSOR_WIDTH*(w-24);
  ctx.font='12px sans-serif';line(ctx,[12,y],[w-12,y],'#bcc8dc',2);
  for(const u of [0,320,640]){line(ctx,[pos(u),y-6],[pos(u),y+6],'#a1b1cc');ctx.fillStyle='#53627b';ctx.textAlign=u===0?'left':u===640?'right':'center';ctx.fillText(String(u),pos(u),80);}
  const ideal=current.ideal[side], measured=current.measured[side];
  if(ideal>=0 && ideal<640)dot(ctx,pos(ideal),y,5,'#ae7600');
  if(measured>=0 && measured<640){line(ctx,[pos(measured),y-15],[pos(measured),y+15],'#244dde',3);ctx.textAlign='center';ctx.fillStyle='#244dde';ctx.fillText(measured.toFixed(1)+' px',Math.max(35,Math.min(w-35,pos(measured))),17);}
  else {ctx.fillStyle='#a44321';ctx.textAlign='center';ctx.fillText('测量位于画面外',w/2,18);}
}
function drawChart() {
  const {ctx,w,h}=surface('chart'); const values=curve.filter(p=>p.medianRelativeError!==null);
  const ymax=Math.max(2,...values.map(p=>p.medianRelativeError*100))*1.12;
  const xy=(b,e)=>[46+(b-.1)/2.9*(w-60),h-32-e/ymax*(h-55)];
  ctx.font='12px sans-serif';
  for(let i=0;i<=4;i++){const value=ymax*i/4,[,y]=xy(.1,value);line(ctx,[46,y],[w-14,y],'#dfe5ee');ctx.fillStyle='#53627b';ctx.textAlign='right';ctx.fillText(value.toFixed(1),40,y+4);}
  for(const b of [.1,1,2,3]){ctx.textAlign='center';ctx.fillText(b.toFixed(1),xy(b,0)[0],h-9);}
  ctx.beginPath();let drawing=false;
  curve.forEach(p=>{if(p.medianRelativeError===null){drawing=false;return;}const [x,y]=xy(p.baseline,p.medianRelativeError*100);if(drawing)ctx.lineTo(x,y);else ctx.moveTo(x,y);drawing=true;});ctx.strokeStyle='#244dde';ctx.lineWidth=2;ctx.stroke();
  if(stats.medianRelativeError!==null)dot(ctx,...xy(state.baseline,stats.medianRelativeError*100),5,'#ba6e00');
  if(!values.length){ctx.fillStyle='#53627b';ctx.textAlign='center';ctx.fillText('当前设置下没有有效估计',w/2,h/2);}
}
function update() {
  current=observe(state,normalPairs(seed,1)[0]);stats=experiment(state,seed);
  curve=Array.from({length:30},(_,i)=>{const baseline=(i+1)/10;return {baseline,...experiment({...state,baseline},seed)};});
  for(const key of Object.keys(defaults)){$(key).value=state[key];$(key+'-value').textContent=`${state[key].toFixed(key==='focal'?0:2)} ${units[key]}`;}
  const est=current.estimate;
  $('disparity').textContent=(current.measured.left-current.measured.right).toFixed(2)+' px';
  $('depth').textContent=est?est.z.toFixed(3)+' m':'不可估计';
  $('error').textContent=est?(Math.abs(est.z-state.z)/state.z*100).toFixed(2)+'%':'—';
  $('observation').textContent=est?(state.sigma===0?'没有测量噪声时，理想模型能恢复真实位置。':'蓝线带着一点测量误差；试试改变相机间距。'):'目标或测量超出视野，或视差不足以确定前方深度。试着把目标移向中间、降低焦距或噪声。';
  $('trial-summary').textContent=`当前间距：有效 ${stats.valid}/${stats.trials} 次，失败 ${stats.invalid} 次；有效估计相对误差中位数 ${stats.medianRelativeError===null?'不可计算':(stats.medianRelativeError*100).toFixed(2)+'%'}。`;
  if(challenge)$('challenge-status').textContent=stats.medianRelativeError!==null && stats.medianRelativeError<.02 && stats.valid/stats.trials>=.95?'挑战达成！现在试着解释：为什么拉开相机更稳定？':'还差一点，试着拉开两台相机的距离。';
  drawScene();drawSensor('left');drawSensor('right');drawChart();
}
for(const key of Object.keys(defaults))$(key).addEventListener('input',event=>{state[key]=Number(event.target.value);update();});
$('resample').addEventListener('click',()=>{seed++;update();});
$('reset').addEventListener('click',()=>{challenge=false;Object.assign(state,defaults);seed=2026;for(const key of ['x','z','focal','sigma'])$(key).disabled=false;$('challenge-status').textContent='还没有开始。准备好再来。';update();});
$('challenge').addEventListener('click',()=>{challenge=true;Object.assign(state,{baseline:.2,z:8,x:0,focal:700,sigma:2});seed=2026;for(const key of ['x','z','focal','sigma'])$(key).disabled=true;update();$('baseline').focus();});
$('export').addEventListener('click',()=>{const record={schema_version:1,model:'rectified stereo, horizontal X-Z plane',units:{world:'m',image:'px'},parameters:{...state},seed,current,summary:stats,baselineSweep:curve,noise:'Independent Gaussian pixel noise; shared standard samples across baseline values; seed uses LCG + Box-Muller.'};const url=URL.createObjectURL(new Blob([JSON.stringify(record,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='viewpoint-experiment.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
let dragging=null;
$('scene').addEventListener('pointerdown',event=>{const r=$('scene').getBoundingClientRect(), px=event.clientX-r.left,py=event.clientY-r.top;const points=challenge?[['camera',-state.baseline/2,0],['camera',state.baseline/2,0]]:[['target',state.x,state.z],['camera',-state.baseline/2,0],['camera',state.baseline/2,0]];for(const [type,x,z] of points){const [a,b]=world(r.width,r.height,x,z);if(Math.hypot(px-a,py-b)<24){dragging=type;$('scene').setPointerCapture(event.pointerId);break;}}});
$('scene').addEventListener('pointermove',event=>{if(!dragging)return;const r=$('scene').getBoundingClientRect(),x=(event.clientX-r.left-30)/(r.width-60)*8-4,z=(r.height-45-(event.clientY-r.top))/(r.height-75)*16;if(dragging==='camera')state.baseline=Math.max(.1,Math.min(3,Math.abs(x)*2));else {state.x=Math.max(-3,Math.min(3,x));state.z=Math.max(2,Math.min(15,z));}update();});
for(const type of ['pointerup','pointercancel','lostpointercapture'])$('scene').addEventListener(type,()=>{dragging=null;});
new ResizeObserver(()=>{drawScene();drawSensor('left');drawSensor('right');drawChart();}).observe($('scene'));
update();
