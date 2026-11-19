import {inFrame} from './geometry.js';

export const PRESETS = [
  {id:'near', hint:'先记住左右两颗星的距离，再切到远景。相机和焦距保持不变。', parameters:{baseline:.8,z:4,x:0,focal:700,sigma:0}},
  {id:'far', hint:'星星更远，左右位置反而更接近：视差变小了。切回近景比较一下。', parameters:{baseline:.8,z:12,x:0,focal:700,sigma:0}},
  {id:'shake', hint:'淡色小点是 48 次估计的位置。点一下“连拍 8 次”，看看同一颗星能被估到哪里。', parameters:{baseline:.3,z:10,x:0,focal:700,sigma:3}}
];

export const MISSIONS = [
  {id:'distance', title:'星星去哪了', description:'只调整目标深度，把理想视差缩到 50 px 以内，并让星星留在两台相机的视野里。', controls:['z'], parameters:{baseline:.8,z:4,x:0,focal:700,sigma:0}, hint:'让星星离相机远一些，再看左右叠加图。', explanation:'同样的相机间距和焦距下，目标越远，左右图像的位置差越小。', badge:'远近观察员'},
  {id:'steady', title:'给手抖一点距离', description:'目标固定在 8 m，噪声 σ = 2 px。只调整相机间距，让 256 次估计的误差中位数低于 2%，有效率至少 95%。', controls:['baseline'], parameters:{baseline:.2,z:8,x:0,focal:700,sigma:2}, hint:'试着拉开相机。在目标仍可见时，相同的像素误差会变得没那么要紧。', explanation:'拉开相机增加了视差。在这个受控例子中，同样的像素噪声造成的相对深度误差更小。', badge:'稳稳测距员'},
  {id:'frame', title:'别把星星弄丢了', description:'星星跑到画面外了。只调整焦距，让至少 95% 的测量有效，且误差中位数低于 2%。', controls:['focal'], parameters:{baseline:.8,z:3,x:2.4,focal:1000,sigma:1}, hint:'降低焦距相当于“拉远镜头”，视野会变宽。看两片视野能否同时罩住星星。', explanation:'焦距变大会放大视差，也会缩窄视野。先让两台相机都看见目标，才有机会估计深度。', badge:'视野守护员'}
];

export function missionComplete(id, current, stats) {
  if (!current.estimate || !inFrame(current.ideal)) return false;
  if (id === 'distance') return current.ideal.left-current.ideal.right <= 50+1e-9;
  if (id === 'steady' || id === 'frame') {
    return stats.medianRelativeError !== null && stats.medianRelativeError < .02 && stats.valid/stats.trials >= .95;
  }
  return false;
}
