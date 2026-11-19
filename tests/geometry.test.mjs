import test from 'node:test';
import assert from 'node:assert/strict';
import {project,triangulate,experiment,inFrame,normalPairs} from '../geometry.js';
test('known shifted target projects to exact pixels and reconstructs',()=>{
  const p=project({x:1,z:10,baseline:2,focal:800});assert.deepEqual(p,{left:480,right:320});
  assert.deepEqual(triangulate(480,320,2,800),{x:1,z:10,disparity:160});
});
test('invalid and reversed disparity never become finite front-facing estimates',()=>{
  for(const pair of [[320,320],[300,320],[NaN,20]])assert.equal(triangulate(...pair,1,700),null);
  assert.throws(()=>project({x:0,z:0,baseline:1,focal:700}),RangeError);
});
test('image boundaries and out-of-view trials are accounted for',()=>{
  assert.equal(inFrame({left:0,right:639.9}),true);assert.equal(inFrame({left:640,right:320}),false);
  const result=experiment({x:3,z:2,baseline:1,focal:1000,sigma:0});assert.equal(result.valid,0);assert.equal(result.invalid,256);assert.equal(result.medianRelativeError,null);
});
test('noiseless trials recover ground truth without statistical drift',()=>{
  const r=experiment({x:-.5,z:7,baseline:.7,focal:650,sigma:0});assert.equal(r.valid,256);assert.ok(r.medianRelativeError<1e-12);
});
test('seed reproduces measurements and wider baseline improves this controlled case',()=>{
  assert.deepEqual(normalPairs(2026,10),normalPairs(2026,10));
  const p={x:0,z:8,focal:700,sigma:2};const small=experiment({...p,baseline:.2}),large=experiment({...p,baseline:2});
  assert.ok(small.medianRelativeError>.02);assert.ok(large.medianRelativeError<.02);assert.equal(large.valid,256);
});
