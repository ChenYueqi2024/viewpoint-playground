import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {examples, width,height, depth,reference} from '../photo/model.js';
const bytes=readFileSync(new URL('../photo/data/reference.bin',import.meta.url));
const map=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
test('original Motorcycle pixels preserve subpixel disparity and occlusion',()=>{
  assert.equal(bytes.length,2*width*height);
  assert.ok(Math.abs(reference(map,...examples.near).disparity-52.304413)<1/512);
  assert.ok(Math.abs(reference(map,...examples.far).disparity-10.829269)<1/512);
  assert.equal(reference(map,...examples.edge).kind,'occluded');
});
test('one pixel produces greater metric error in the background',()=>{
  const error=name=>{const {disparity}=reference(map,...examples[name]);return depth(disparity-1)-depth(disparity);};
  assert.ok(error('near')>0 && error('far')>error('near'));
  assert.equal(depth(-33),null);
  assert.ok(Math.abs(depth(52.304413)-2.267)<.002);
});
