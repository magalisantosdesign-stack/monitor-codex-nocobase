import {mkdir,copyFile} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {checkDistribution,distributionRoot} from './check-distribution.mjs';
// Export an explicit allowlist into a new directory; never overwrite a release.
const files=await checkDistribution();
const parent=join(distributionRoot,'release');await mkdir(parent,{recursive:true});
const destination=join(parent,'monitor-codex-'+new Date().toISOString().replace(/[:.]/g,'-'));
await mkdir(destination);
for(const name of files){const target=join(destination,name);await mkdir(dirname(target),{recursive:true});await copyFile(join(distributionRoot,name),target);}
console.log(destination);
