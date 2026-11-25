// Preserve the original v1 save key for upgrades. Never choose a save by cash or week.
export const SAVE_KEY = "razor-city-save-v1";
export const BACKUP_KEY = "razor-city-save-mirror-v1";
export const ARCHIVES_KEY = "razor-city-saved-runs-v1";
type StorageIO = Pick<Storage,"getItem"|"setItem"|"removeItem">;
export function readSnapshot<T>(io:StorageIO, decode:(raw:string)=>T|null): {game:T;recovered:boolean}|null {
  for (const key of [SAVE_KEY,BACKUP_KEY]) {
    try { const raw=io.getItem(key); if(raw){const game=decode(raw);if(game)return {game,recovered:key===BACKUP_KEY};} } catch { /* try other copy */ }
  }
  return null;
}
export function writeSnapshot(io:StorageIO,raw:string|null):boolean {
  try {
    if(raw===null){io.removeItem(BACKUP_KEY);io.removeItem(SAVE_KEY);return true;}
    io.setItem(SAVE_KEY,raw);
  } catch { return false; }
  try {io.setItem(BACKUP_KEY,raw);} catch { /* primary was successfully saved */ }
  return true;
}
export function readArchives<T>(io:StorageIO,decode:(raw:string)=>T|null):{raw:string;game:T}[] {
  try {
    const values:unknown=JSON.parse(io.getItem(ARCHIVES_KEY)||"[]");
    if(!Array.isArray(values))return [];
    return values.flatMap(raw=>{try{if(typeof raw!=="string")return [];const game=decode(raw);return game?[{raw,game}]:[];}catch{return [];}}).slice(0,3);
  }catch{return [];}
}
export function archiveSnapshot<T>(io:StorageIO,raw:string,decode:(raw:string)=>T|null):boolean {
  try {
    const existing=readArchives(io,decode).map(x=>x.raw);
    io.setItem(ARCHIVES_KEY,JSON.stringify([raw,...existing.filter(x=>x!==raw)].slice(0,3)));
    return true;
  }catch{return false;}
}

// Preserve unreadable bytes before a player explicitly restores an archived run.
export const QUARANTINE_KEY="razor-city-unreadable-save-v1";
export function quarantineSnapshot(io:StorageIO):boolean {
  try {
    const prior=io.getItem(QUARANTINE_KEY);
    const current={primary:io.getItem(SAVE_KEY),mirror:io.getItem(BACKUP_KEY)};
    const history:unknown=prior?JSON.parse(prior):[];
    if(!Array.isArray(history))return false;
    io.setItem(QUARANTINE_KEY,JSON.stringify([current,...history]));
    return true;
  }catch{return false;}
}
