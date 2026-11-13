import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {spawnSync} from 'node:child_process'
import {resolve} from 'node:path'
import {pathToFileURL} from 'node:url'

const receipt='ums_address_creation_receipt',schemas=['pms','sms','ums','oms','wms'],definitions=[]
let schema
for(const match of readFileSync(new URL('../infra/mysql/001-schema.sql',import.meta.url),'utf8').matchAll(/\bUSE\s+`?(gulimall_(?:pms|sms|ums|oms|wms)_demo)`?\s*;|CREATE TABLE `([^`]+)`/g)){
 if(match[1])schema=match[1];else {assert(schema,'Schema must precede its table');definitions.push([schema,match[2]])}
}
assert.equal(definitions.length,72,'Define a new recognized structure version before changing the table set')
export function backupStructureVersion(manifest){const version=manifest.structureVersion===undefined?1:manifest.structureVersion;assert([1,2].includes(version),'Unsupported backup structure version');return version}
export function expectedDatabaseTables(suffix,version){assert(['demo','test'].includes(suffix),'Only known Demo/Test schemas are allowed');assert([1,2].includes(version),'Unsupported database structure version');return definitions.filter(([,name])=>version===2||name!==receipt).map(([db,name])=>db.replace(/_demo$/,'_'+suffix)+'.'+name).sort()}
const rows=text=>text.trim()?text.trim().split(/\r?\n/).map(line=>line.split('\t')):[]
export function inspectDatabaseStructure(query,suffix,expectedVersion){
 expectedDatabaseTables(suffix,1)
 if(expectedVersion!==undefined)assert([1,2].includes(expectedVersion),'Unsupported expected structure version')
 const databases=schemas.map(name=>`'gulimall_${name}_${suffix}'`).join(','),ums=`gulimall_ums_${suffix}`,wms=`gulimall_wms_${suffix}`
 const tables=rows(query(`SELECT CONCAT(table_schema,'.',table_name),engine,table_type FROM information_schema.tables WHERE table_schema IN (${databases}) ORDER BY table_schema,table_name;`))
 const version=tables.some(([name])=>name===ums+'.'+receipt)?2:1
 assert.deepEqual(tables.map(([name])=>name).sort(),expectedDatabaseTables(suffix,version),'Database table names do not match a recognized structure version')
 assert(tables.every(([,engine,type])=>engine==='InnoDB'&&type==='BASE TABLE'),'Transactional base tables are required')
 if(expectedVersion!==undefined)assert.equal(version,expectedVersion,'Migrate the isolated copy before starting business services')
 const columns=rows(query(`SELECT table_name,column_name,data_type,is_nullable,COALESCE(character_maximum_length,0),COALESCE(collation_name,'') FROM information_schema.columns WHERE (table_schema='${ums}' AND table_name='${receipt}') OR (table_schema='${wms}' AND table_name='wms_ware_info' AND column_name IN ('creation_request_id','creation_request_hash')) ORDER BY table_name,column_name;`))
 const indexes=rows(query(`SELECT table_name,index_name,non_unique,seq_in_index,column_name,COALESCE(sub_part,0) FROM information_schema.statistics WHERE (table_schema='${ums}' AND table_name='${receipt}') OR (table_schema='${wms}' AND table_name='wms_ware_info') ORDER BY table_name,index_name,seq_in_index;`))
 const expectedColumns=version===1?[]:[
  [receipt,'address_id','bigint','NO','0',''],[receipt,'creation_request_hash','char','NO','64','ascii_bin'],[receipt,'creation_request_id','char','NO','36','ascii_bin'],[receipt,'member_id','bigint','NO','0',''],
  ['wms_ware_info','creation_request_hash','char','YES','64','ascii_bin'],['wms_ware_info','creation_request_id','char','YES','36','ascii_bin'],
 ]
 const expectedIndexes=version===1?[['wms_ware_info','PRIMARY','0','1','id','0']]:[
  [receipt,'PRIMARY','0','1','member_id','0'],[receipt,'PRIMARY','0','2','creation_request_id','0'],['wms_ware_info','PRIMARY','0','1','id','0'],['wms_ware_info','uk_ware_creation_request','0','1','creation_request_id','0'],
 ]
 assert.deepEqual(columns,expectedColumns,'Creation receipt columns must match their structure version exactly')
 assert.deepEqual(indexes,expectedIndexes,'Creation receipt and warehouse indexes must preserve the specified uniqueness')
 assert.equal(query(`SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema='${ums}' AND table_name='${receipt}';`).trim(),'0','Address receipts cannot follow physical address deletion through foreign keys')
 return {structureVersion:version,tables:tables.length}
}
if(process.argv[1]&&!process.execArgv.some(arg=>arg==='-e'||arg==='--eval'||arg.startsWith('--eval='))&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 const [container,suffix,version,...extra]=process.argv.slice(2)
 assert(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(container||'')&&extra.length===0,'Expected a Docker container, Demo/Test suffix and optional structure version')
 assert(version===undefined||['1','2'].includes(version),'Unsupported structure version')
 const query=statement=>{const result=spawnSync('docker',['exec','-i',container,'sh','-c','MYSQL_PWD="${MYSQL_PASSWORD:-$MYSQL_ROOT_PASSWORD}" exec mysql -u"${MYSQL_USER:-root}" --default-character-set=utf8mb4 --batch --skip-column-names'],{input:statement,encoding:'utf8',windowsHide:true,timeout:30000,maxBuffer:1024*1024});assert.equal(result.status,0,'Read-only database structure inspection failed');return result.stdout}
 console.log(JSON.stringify(inspectDatabaseStructure(query,suffix,version===undefined?undefined:Number(version))))
}
