import test from "node:test";
import assert from "node:assert/strict";
import {minutesForDisplay,metricsValue} from "../src/utils/statsViews.js";

test("estima solo minutos ausentes a partir de partidos DEL JUGADOR",()=>{
 const estimated={minutes:null,appearances:12,team_matches:38};
 assert.deepEqual(minutesForDisplay(estimated),{value:1080,estimated:true});
 assert.equal(metricsValue(estimated,"minutes"),1080);
 assert.deepEqual(minutesForDisplay({minutes:723,appearances:12}),{value:723,estimated:false});
 assert.deepEqual(minutesForDisplay({minutes:0,appearances:12}),{value:0,estimated:false});
 assert.deepEqual(minutesForDisplay({minutes:null,appearances:null,team_matches:38}),{value:null,estimated:false});
 assert.deepEqual(minutesForDisplay({minutes:null,appearances:0}),{value:null,estimated:false});
});
