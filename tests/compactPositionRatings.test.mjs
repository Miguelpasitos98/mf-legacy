import test from 'node:test';
import assert from 'node:assert/strict';
import {compactPositionValue} from '../src/utils/compactPositionRatings.js';
test('MC preferido recibe 20 visual y el otro usa MC central',()=>{
 const ratings={centrocampista_izquierdo:1,centrocampista_derecho:6,centrocampista:13};
 assert.equal(compactPositionValue(ratings,'mc_right'),20);
 assert.equal(compactPositionValue(ratings,'mc_left'),13);
 assert.deepEqual(ratings,{centrocampista_izquierdo:1,centrocampista_derecho:6,centrocampista:13});
});
test('sin preferencia unilateral no inventa 20',()=>{
 assert.equal(compactPositionValue({centrocampista_izquierdo:5,centrocampista_derecho:5,centrocampista:12},'mc_left'),12);
 assert.equal(compactPositionValue({centrocampista_izquierdo:5,centrocampista_derecho:5,centrocampista:12},'mc_right'),12);
});
test('carrileros siguen tomando el máximo lateral',()=>{
 assert.equal(compactPositionValue({carrilero_izquierdo:5,defensa_izquierdo:16},'carrilero_izquierdo'),16);
});
