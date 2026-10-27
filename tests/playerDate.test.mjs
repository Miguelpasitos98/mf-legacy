import test from 'node:test';
import assert from 'node:assert/strict';
import {formatBirthDate,birthAge,parseBirthDate} from '../src/utils/playerDate.js';
test('la ficha conserva DD/MM/YYYY y coincide con PLAYERS',()=>{
 assert.equal(formatBirthDate('11/02/1998'),'11/02/1998');
 assert.equal(birthAge('11/02/1998',new Date(2026,9,27)),28);
 assert.equal(birthAge('02/11/1998',new Date(2026,9,27)),27);
});
test('fecha ISO conserva el día civil y valida calendario y cumpleaños',()=>{
 assert.equal(formatBirthDate('1998-02-11T00:00:00Z'),'11/02/1998');
 assert.equal(birthAge('2000-11-02',new Date(2026,10,1)),25);
 assert.equal(birthAge('2000-11-02',new Date(2026,10,2)),26);
 assert.equal(parseBirthDate('31/02/2000'),null);
 assert.equal(parseBirthDate(''),null);
 assert.equal(birthAge('2030-01-01',new Date(2026,9,27)),null);
});
