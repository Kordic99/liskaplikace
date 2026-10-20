import assert from 'node:assert/strict';
export function validateReleaseHistory(entries,previous,{sameBuild=false}={}){
 assert.ok(Array.isArray(entries)&&entries.length,'Release history must contain at least one update');
 for(const [index,entry] of entries.entries()){
  assert.equal(entry.id,index+1,'Release IDs must be consecutive and ascending');
  assert.match(entry.date,/^\d{4}-\d{2}-\d{2}$/);
  assert.equal(new Date(entry.date).toISOString().slice(0,10),entry.date,'Release date must be valid');
  assert.ok(typeof entry.title==='string'&&entry.title.trim(),'Release title is required');
  assert.ok(Array.isArray(entry.changes)&&entry.changes.length&&entry.changes.every(change=>typeof change==='string'&&change.trim()),'Describe user-facing changes');
  assert.equal(new Set(entry.changes).size,entry.changes.length,'Duplicate release bullet');
  if(index)assert.ok(entry.date>=entries[index-1].date,'Release dates must not go backwards');
 }
 if(previous){assert.ok(sameBuild||entries.length>previous.length,'Every deployment must append a new release entry');assert.deepEqual(entries.slice(0,previous.length),previous,'Published release notes must remain unchanged')}
}
