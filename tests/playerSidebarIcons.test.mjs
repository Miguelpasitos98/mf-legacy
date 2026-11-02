import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const source=fs.readFileSync("src/components/Sidebar.jsx","utf8");
test("PLAYERS sidebar retains eight views while displaying icons only",()=>{
  for(const id of ["all","teams","leagues","candidates","countries","positions","age","description"]){
    assert.match(source,new RegExp('id: "'+id+'"'));
  }
  assert.match(source,/VIEW_OPTIONS\.slice\(0, 4\)/);
  assert.match(source,/VIEW_OPTIONS\.slice\(4\)/);
  assert.doesNotMatch(source,/<span[^>]*>\{option\.label\}<\/span>/);
  assert.match(source,/aria-label=\{option\.label\}/);
  assert.match(source,/title=\{option\.label\}/);
});
test("icons are spaced across the height and remain accessible on shorter screens",()=>{
  assert.match(source,/min-h-\[220px\] w-full flex-1 flex-col items-center justify-evenly/);
  assert.match(source,/absolute inset-0 flex min-h-0 flex-col items-center overflow-y-auto/);
  assert.match(source,/h-11 w-11 shrink-0 items-center justify-center/);
  assert.match(source,/h-6 w-6 object-contain/);
  assert.match(source,/aria-label="Cerrar menú"/);
});
