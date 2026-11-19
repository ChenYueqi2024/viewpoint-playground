import test from 'node:test';
import assert from 'node:assert/strict';
import {project, observe, experiment, normalPairs} from '../geometry.js';
import {PRESETS, MISSIONS, missionComplete} from '../lessons.js';

function passes(mission, changes={}) {
  const parameters={...mission.parameters,...changes};
  return missionComplete(mission.id,observe(parameters,normalPairs(2026,1)[0]),experiment(parameters));
}

test('near/far presets isolate depth and show a threefold disparity change',()=>{
  const [near,far]=PRESETS.map(p=>p.parameters);
  for(const key of ['baseline','x','focal','sigma'])assert.equal(near[key],far[key]);
  const a=project(near),b=project(far);
  assert.ok(Math.abs((a.left-a.right)-3*(b.left-b.right))<1e-10);
});
test('missions start incomplete and can be solved using only their allowed controls',()=>{
  const solutions=[{z:12},{baseline:2},{focal:300}];
  MISSIONS.forEach((mission,i)=>{
    assert.equal(passes(mission),false,mission.id+' should not auto-complete');
    assert.ok(Object.keys(solutions[i]).every(key=>mission.controls.includes(key)));
    assert.equal(passes(mission,solutions[i]),true,mission.id+' must have an achievable solution');
  });
});
test('low error alone cannot pass a mission when most trials fail or a target is out of frame',()=>{
  const p={...MISSIONS[1].parameters,baseline:2};
  const current=observe(p,[0,0]);
  assert.equal(missionComplete('steady',current,{trials:256,valid:10,medianRelativeError:0}),false);
  assert.equal(missionComplete('steady',current,{trials:256,valid:256,medianRelativeError:null}),false);
  assert.equal(missionComplete('frame',{...current,ideal:{left:640,right:320}},{trials:256,valid:256,medianRelativeError:0}),false);
  assert.equal(missionComplete('distance',{...current,estimate:null},{trials:256,valid:0,medianRelativeError:null}),false);
});
test('distance mission threshold includes exactly 50px but excludes a larger disparity',()=>{
  assert.equal(passes(MISSIONS[0],{z:11.2}),true);
  assert.equal(passes(MISSIONS[0],{z:11.1}),false);
});
