import {project, observe, experiment, normalPairs, CX, SENSOR_WIDTH} from './geometry.js';
import {PRESETS, MISSIONS, missionComplete} from './lessons.js';

const defaults = {baseline:.6, z:8, x:0, focal:700, sigma:1};
const state = {...defaults};
let seed = 2026, mission = null, curve = [], current, stats, cloud = [], burstTimer = null;
const completed = new Set();
const $ = id => document.getElementById(id);
const units = {baseline:'m', z:'m', x:'m', focal:'px', sigma:'px'};
const colors = {left:'#70dce8', right:'#f6a5cb', yellow:'#ffdc77', muted:'#afc1dc', white:'#edf4ff'};
const landmarks = [{x:-.8,z:4,kind:'circle',color:'#6bd6ad'}, {x:.8,z:12,kind:'square',color:'#baa5ff'}];

function surface(id) {
  const canvas=$(id), rect=canvas.getBoundingClientRect(), ratio=devicePixelRatio || 1;
  canvas.width=Math.round(rect.width*ratio);canvas.height=Math.round(rect.height*ratio);
  const ctx=canvas.getContext('2d');ctx.scale(ratio,ratio);
  return {ctx,w:rect.width,h:rect.height};
}
function line(ctx,a,b,color,width=1,dash=[]) {
  ctx.beginPath();ctx.setLineDash(dash);ctx.moveTo(...a);ctx.lineTo(...b);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();ctx.setLineDash([]);
}
function dot(ctx,x,y,r,color) {ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();}
function glyph(ctx,x,y,r,kind,color) {
  ctx.fillStyle=color;
  if(kind==='circle'){dot(ctx,x,y,r,color);return;}
  if(kind==='square'){ctx.fillRect(x-r,y-r,r*2,r*2);return;}
  ctx.beginPath();
  for(let i=0;i<10;i++){const angle=-Math.PI/2+i*Math.PI/5, radius=i%2?r*.48:r;const a=x+Math.cos(angle)*radius,b=y+Math.sin(angle)*radius;if(i)ctx.lineTo(a,b);else ctx.moveTo(a,b);}
  ctx.closePath();ctx.fill();
  if(r>=9){dot(ctx,x-r*.2,y,1,'#6d4b16');dot(ctx,x+r*.2,y,1,'#6d4b16');}
}
function world(w,h,x,z) {return [30+(x+4)/8*(w-60),h-45-z/16*(h-75)];}
function inScene(point) {return point && point.z<=16 && Math.abs(point.x)<=4;}
function drawScene() {
  const {ctx,w,h}=surface('scene');ctx.font='14px "Segoe UI",sans-serif';
  for(let x=-4;x<=4;x++)line(ctx,world(w,h,x,0),world(w,h,x,16),'#293c59');
  const tickStep=h<140?8:h<220?4:2;
  for(let z=0;z<=16;z+=2){line(ctx,world(w,h,-4,z),world(w,h,4,z),'#293c59');if(z%tickStep===0){ctx.fillStyle=colors.muted;ctx.fillText(z+'m',3,world(w,h,0,z)[1]+4);}}
  ctx.save();ctx.beginPath();ctx.rect(30,30,w-60,h-75);ctx.clip();
  if($('show-fov').checked) {
    for(const [position,color] of [[-state.baseline/2,'rgba(112,220,232,.12)'],[state.baseline/2,'rgba(246,165,203,.12)']]) {
      const spread=CX/state.focal*16;ctx.beginPath();ctx.moveTo(...world(w,h,position,0));
      ctx.lineTo(...world(w,h,position-spread,16));ctx.lineTo(...world(w,h,position+spread,16));ctx.closePath();ctx.fillStyle=color;ctx.fill();
    }
  }
  if($('show-cloud').checked)for(const point of cloud)if(inScene(point))dot(ctx,...world(w,h,point.x,point.z),2.5,'#b7c9ef88');
  for(const landmark of landmarks)glyph(ctx,...world(w,h,landmark.x,landmark.z),5,landmark.kind,landmark.color);
  const truePoint=world(w,h,state.x,state.z);
  for(const [side,position] of [['left',-state.baseline/2],['right',state.baseline/2]]) {
    const camera=world(w,h,position,0), slope=(current.measured[side]-CX)/state.focal;
    line(ctx,camera,world(w,h,position+slope*16,16),colors[side],2);
    line(ctx,camera,truePoint,'#e5c27480',1,[4,5]);
  }
  ctx.restore();
  for(const [side,position,label] of [['left',-state.baseline/2,'L'],['right',state.baseline/2,'R']]) {
    const [x,y]=world(w,h,position,0);ctx.fillStyle=colors[side];ctx.fillRect(x-10,y-6,20,13);ctx.fillRect(x-5,y-11,10,5);
    dot(ctx,x,y,3,'#152642');ctx.fillStyle=colors[side];ctx.textAlign='center';ctx.fillText(label,x+(side==='left'?-10:10),y+28);
  }
  ctx.textAlign='left';glyph(ctx,...truePoint,13,'star',colors.yellow);
  ctx.fillStyle=colors.yellow;ctx.fillText('星星',Math.max(31,Math.min(truePoint[0]+15,w-60)),truePoint[1]-14);
  if(inScene(current.estimate)) {
    const [x,y]=world(w,h,current.estimate.x,current.estimate.z);ctx.save();ctx.translate(x,y);ctx.rotate(Math.PI/4);ctx.strokeStyle=colors.white;ctx.lineWidth=2;ctx.strokeRect(-5,-5,10,10);ctx.restore();
  }
  ctx.fillStyle=colors.muted;ctx.fillText('Z 向前 · X 横向',38,22);
}
function drawSensor(side) {
  const {ctx,w}=surface(side+'-sensor'), pos=u=>16+u/SENSOR_WIDTH*(w-32), y=57;
  const accent=side==='left'?'#00798d':'#b63471';
  ctx.font='14px sans-serif';line(ctx,[16,y],[w-16,y],'#d0dcec',1,[3,4]);
  ctx.save();ctx.beginPath();ctx.rect(16,15,w-32,88);ctx.clip();
  for(const obj of [...landmarks,{x:state.x,z:state.z,kind:'star',color:'#b57600'}]) {
    const u=project({...state,x:obj.x,z:obj.z})[side];
    const radius=Math.max(5,Math.min(23,state.focal*.25/obj.z*(w-32)/640));
    glyph(ctx,pos(u),y,radius,obj.kind,obj.color);
  }
  const measured=current.measured[side];
  if(measured>=0 && measured<640)line(ctx,[pos(measured),y-27],[pos(measured),y+27],accent,2);
  ctx.restore();
  line(ctx,[16,115],[w-16,115],'#a1b1cc');
  for(const u of [0,320,640]){line(ctx,[pos(u),110],[pos(u),120],'#a1b1cc');ctx.fillStyle='#53627b';ctx.textAlign=u===0?'left':u===640?'right':'center';ctx.fillText(String(u),pos(u),140);}
  if(current.ideal[side]<0 || current.ideal[side]>=640){ctx.fillStyle='#9f3d23';ctx.textAlign='center';ctx.fillText('星星出画了',w/2,22);}
}
function drawOverlay() {
  const {ctx,w}=surface('stereo-overlay'), pos=u=>20+u/640*(w-40);
  ctx.font='14px sans-serif';
  for(const [side,y,label,color] of [['left',28,'L','#00798d'],['right',67,'R','#b63471']]) {
    line(ctx,[20,y],[w-20,y],'#cbd8eb');ctx.fillStyle=color;ctx.fillText(label,2,y+5);
    const u=current.measured[side];
    if(u>=0 && u<640)glyph(ctx,pos(u),y,9,'star',color);
    else {ctx.textAlign='right';ctx.fillText('画面外',w-20,y-7);ctx.textAlign='left';}
  }
  const {left,right}=current.measured;
  if(left>=0 && left<640 && right>=0 && right<640) {
    line(ctx,[pos(left),28],[pos(left),90],'#00798d',1,[3,3]);line(ctx,[pos(right),67],[pos(right),90],'#b63471',1,[3,3]);
    line(ctx,[pos(right),89],[pos(left),89],'#364d77',2);
    for(const u of [left,right])line(ctx,[pos(u),84],[pos(u),94],'#364d77',2);
  }
  ctx.fillStyle='#53627b';ctx.fillText('0 px',20,116);ctx.textAlign='right';ctx.fillText('640 px',w-20,116);
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

function updateMission() {
  const passed=mission && missionComplete(mission.id,current,stats);
  if(passed)completed.add(mission.id);
  for(const item of MISSIONS) {
    const won=completed.has(item.id),card=document.querySelector('[data-mission-card="'+item.id+'"]');
    card.classList.toggle('completed',won);card.classList.toggle('active',mission?.id===item.id);
    $('badge-'+item.id).textContent=won?'✦':({distance:'✧',steady:'◇',frame:'◎'}[item.id]);
    $('badge-'+item.id).setAttribute('aria-label',item.badge+(won?'，已完成':'，尚未完成'));
  }
  $('mission-progress').textContent='已点亮 '+completed.size+' / 3 枚徽章';
  $('live-mission').hidden=!mission;
  $('next-challenge').hidden=!passed || MISSIONS.indexOf(mission)===MISSIONS.length-1;
  if(mission) {
    $('live-mission-title').textContent=mission.title;$('live-mission-goal').textContent=mission.description;
    const message=passed?'挑战达成！获得「'+mission.badge+'」。'+mission.explanation:'还差一点：'+mission.hint;
    $('live-mission-status').textContent=message;$('challenge-status').textContent=message;
    $('live-mission').classList.toggle('won',passed);
  }else $('challenge-status').textContent='选一个挑战开始。徽章只保留在本次页面会话中。';
}
function update() {
  current=observe(state,normalPairs(seed,1)[0]);stats=experiment(state,seed);
  cloud=normalPairs(seed,48).map(pair=>observe(state,pair).estimate);
  curve=Array.from({length:30},(_,i)=>{const baseline=(i+1)/10;return {baseline,...experiment({...state,baseline},seed)};});
  for(const key of Object.keys(defaults)){$(key).value=state[key];$(key+'-value').textContent=state[key].toFixed(key==='focal'?0:2)+' '+units[key];}
  const est=current.estimate,disparity=current.measured.left-current.measured.right;
  $('disparity').textContent=disparity.toFixed(2)+' px';$('depth').textContent=est?est.z.toFixed(3)+' m':'不可估计';
  $('error').textContent=est?(Math.abs(est.z-state.z)/state.z*100).toFixed(2)+'%':'—';
  $('true-depth').textContent='真实深度 '+state.z.toFixed(2)+' m';
  $('projection-caption').textContent='L '+current.measured.left.toFixed(2)+' px · R '+current.measured.right.toFixed(2)+' px · 相差 '+disparity.toFixed(2)+' px';
  $('knowledge-depth-values').textContent='当前 B = '+state.baseline.toFixed(2)+' m，f = '+state.focal.toFixed(0)+' px，Z = '+state.z.toFixed(2)+' m；理想视差 fB/Z = '+(state.focal*state.baseline/state.z).toFixed(2)+' px。实际测量视差见叠加图。';
  const approximateSigma=Math.SQRT2*state.sigma*state.z**2/(state.focal*state.baseline);
  $('knowledge-noise-values').textContent='当前参数的一阶深度标准差近似为 '+approximateSigma.toFixed(3)+' m。'+(approximateSigma/state.z>.1?'扰动相对深度已较大，请谨慎理解这个近似。':'这描述的是近似波动尺度，不是这一次必然偏移的距离。');
  $('knowledge-fov-values').textContent='当前 f = '+state.focal.toFixed(0)+' px，对应水平视场角约 '+(2*Math.atan(SENSOR_WIDTH/(2*state.focal))*180/Math.PI).toFixed(1)+'°。';
  $('stereo-overlay').setAttribute('aria-label',$('projection-caption').textContent);
  const leftVisible=current.ideal.left>=0 && current.ideal.left<640, rightVisible=current.ideal.right>=0 && current.ideal.right<640;
  $('observation').textContent=!leftVisible || !rightVisible
    ? (!leftVisible && !rightVisible?'两台相机都看不见星星。':(!leftVisible?'左相机':'右相机')+'看不见星星。')+'试着把星星移回中间，或降低焦距扩大视野。'
    : !est?'星星可见，但这次测量超出画面或视差非正；这一次不能估计前方深度。'
    : !inScene(est)?'这次估计落在俯视图范围外。下方数值仍然有效；试着减小噪声或增大相机间距。'
    : state.sigma===0?'星星与菱形重合了：没有噪声时，理想模型恢复了真实位置。':'星星不动，估计也会偏。点“连拍”，观察白色菱形和淡色点群。';
  $('cloud-summary').textContent=$('show-cloud').checked?'48 次估计：'+cloud.filter(inScene).length+' 个在图内，'+cloud.filter(p=>p&&!inScene(p)).length+' 个在图外，'+cloud.filter(p=>!p).length+' 次不可估计。':'已隐藏估计点群。';
  $('trial-summary').textContent='当前间距：有效 '+stats.valid+'/'+stats.trials+' 次，失败 '+stats.invalid+' 次；有效估计相对误差中位数 '+(stats.medianRelativeError===null?'不可计算':(stats.medianRelativeError*100).toFixed(2)+'%')+'。';
  updateMission();drawScene();drawSensor('left');drawSensor('right');drawOverlay();drawChart();
}
function stopBurst(message='') {
  if(burstTimer!==null)clearInterval(burstTimer);
  burstTimer=null;$('burst').textContent='连拍 8 次';$('burst').setAttribute('aria-pressed','false');$('burst-status').textContent=message;
}
function unlock() {
  mission=null;for(const key of Object.keys(defaults))$(key).disabled=false;
  $('resample').disabled=false;$('burst').disabled=false;$('control-note').textContent='相机一左一右，像你的两只眼睛。';
}
function clearPreset() {
  document.querySelectorAll('[data-preset]').forEach(button=>button.setAttribute('aria-pressed','false'));
  $('preset-hint').textContent=mission?'挑战模式：'+mission.hint:'自由实验：试试一次只改变一个旋钮，观察左右画面和视差。';
}
function showObservation() {
  const rect=$('scene').getBoundingClientRect();
  if(rect.top<0||rect.bottom>innerHeight)$('play').scrollIntoView({block:'start',behavior:'instant'});
}
function startMission(id) {
  stopBurst();mission=MISSIONS.find(item=>item.id===id);clearPreset();Object.assign(state,mission.parameters);seed=2026;
  for(const key of Object.keys(defaults))$(key).disabled=!mission.controls.includes(key);
  $('resample').disabled=true;$('burst').disabled=true;
  $('control-note').textContent='挑战使用固定条件，只开放本关需要的旋钮。';
  update();$(mission.controls[0]).focus();showObservation();
}
for(const key of Object.keys(defaults))$(key).addEventListener('input',event=>{stopBurst();clearPreset();state[key]=Number(event.target.value);update();});
for(const id of ['show-fov','show-cloud'])$(id).addEventListener('change',update);
document.querySelectorAll('[data-preset]').forEach(button=>button.addEventListener('click',()=>{
  stopBurst();unlock();clearPreset();const preset=PRESETS.find(item=>item.id===button.dataset.preset);
  Object.assign(state,preset.parameters);seed=2026;button.setAttribute('aria-pressed','true');$('preset-hint').textContent=preset.hint;update();showObservation();
}));
document.querySelectorAll('[data-mission]').forEach(button=>button.addEventListener('click',()=>startMission(button.dataset.mission)));
$('next-challenge').addEventListener('click',()=>{const next=MISSIONS[MISSIONS.indexOf(mission)+1];if(next)startMission(next.id);});
$('exit-challenge').addEventListener('click',()=>{unlock();clearPreset();update();$('baseline').focus();showObservation();});
$('resample').addEventListener('click',()=>{stopBurst();seed++;update();});
$('burst').addEventListener('click',()=>{
  if(burstTimer!==null){stopBurst('连拍已暂停。');return;}
  let count=0;const samples=[];
  $('burst').textContent='暂停连拍';$('burst').setAttribute('aria-pressed','true');
  const tick=()=>{seed++;count++;update();samples.push(current.estimate?current.estimate.z.toFixed(2)+' m':'不可估计');$('burst-status').textContent='第 '+count+' / 8 次 · '+samples.slice(-3).join(' / ');if(count===8)stopBurst('连拍完成，最后三次：'+samples.slice(-3).join(' / '));};
  burstTimer=setInterval(tick,650);tick();
});
document.addEventListener('visibilitychange',()=>{if(document.hidden && burstTimer!==null)stopBurst('离开页面，已暂停连拍。');});
$('reset').addEventListener('click',()=>{stopBurst();unlock();clearPreset();Object.assign(state,defaults);seed=2026;update();showObservation();});
$('export').addEventListener('click',()=>{
  const record={schema_version:2,app_version:'0.4.2',model:'rectified stereo, horizontal X-Z plane',units:{world:'m',image:'px'},parameters:{...state},seed,current,summary:stats,baselineSweep:curve,displaySamples:{trials:48,estimates:cloud},lesson:{active:mission?.id??null,completed:[...completed]},noise:'Independent Gaussian pixel noise; shared standard samples across baseline values; seed uses LCG + Box-Muller.'};
  const url=URL.createObjectURL(new Blob([JSON.stringify(record,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='viewpoint-experiment.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
let dragging=null;
$('scene').addEventListener('pointerdown',event=>{
  const r=$('scene').getBoundingClientRect(), px=event.clientX-r.left,py=event.clientY-r.top;
  const points=[['target',state.x,state.z],['camera',-state.baseline/2,0],['camera',state.baseline/2,0]];
  for(const [type,x,z] of points) {
    if(type==='camera' && $('baseline').disabled || type==='target' && $('x').disabled && $('z').disabled)continue;
    const [a,b]=world(r.width,r.height,x,z);
    if(Math.hypot(px-a,py-b)<24){stopBurst();clearPreset();dragging=type;$('scene').setPointerCapture(event.pointerId);break;}
  }
});
$('scene').addEventListener('pointermove',event=>{
  if(!dragging)return;
  const r=$('scene').getBoundingClientRect(),x=(event.clientX-r.left-30)/(r.width-60)*8-4,z=(r.height-45-(event.clientY-r.top))/(r.height-75)*16;
  if(dragging==='camera')state.baseline=Math.max(.1,Math.min(3,Math.abs(x)*2));
  else {if(!$('x').disabled)state.x=Math.max(-3,Math.min(3,x));if(!$('z').disabled)state.z=Math.max(2,Math.min(15,z));}update();
});
for(const type of ['pointerup','pointercancel','lostpointercapture'])$('scene').addEventListener(type,()=>{dragging=null;});
new ResizeObserver(()=>{drawScene();drawSensor('left');drawSensor('right');drawOverlay();drawChart();}).observe($('scene'));
new ResizeObserver(([entry])=>document.documentElement.style.setProperty('--station-height',`${entry.target.getBoundingClientRect().height+12}px`)).observe(document.querySelector('.observation-station'));
document.querySelectorAll('[data-explain]').forEach(button=>{
  const panel=$('knowledge-'+button.dataset.explain);button.hidden=false;
  panel.addEventListener('toggle',()=>button.setAttribute('aria-expanded',String(panel.open)));
  button.addEventListener('click',()=>{
    panel.open=!panel.open;button.setAttribute('aria-expanded',String(panel.open));
    if(panel.open){panel.querySelector('summary').focus();panel.scrollIntoView({block:'start',behavior:'instant'});}
  });
});
update();
