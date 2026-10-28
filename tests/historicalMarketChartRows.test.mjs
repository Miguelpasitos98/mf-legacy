import test from 'node:test';
import assert from 'node:assert/strict';
import {historicalMarketChartRows} from '../src/utils/historicalMarketChartRows.js';
test('convierte valoraciones persistentes de Haaland a millones y respeta fechas reales',()=>{
 const rows=historicalMarketChartRows([
  {season:'2025/2026',transfermarkt_value_eur:200000000,market_value_as_of:'2026-06-03'},
  {season:'2024/2025',transfermarkt_value_eur:180000000,market_value_as_of:'2025-05-30'},
  {season:'2026/2027',transfermarkt_value_eur:220000000,market_value_as_of:null}
 ]);
 assert.deepEqual(rows.map(x=>[x.date,x.value]),[['2025-05-30',180],['2026-06-03',200]]);
});
test('no genera ceros falsos ni fechas futuras para temporadas sin datos',()=>{
 assert.deepEqual(historicalMarketChartRows([{season:'2025/2026',transfermarkt_value_eur:null}]),[]);
});
