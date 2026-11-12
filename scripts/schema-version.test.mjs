import test from 'node:test'
import assert from 'node:assert/strict'
import {backupStructureVersion,expectedDatabaseTables,inspectDatabaseStructure} from './schema-version.mjs'

const receipt='ums_address_creation_receipt'
function database(version){
 const tables=expectedDatabaseTables('test',version).map(name=>[name,'InnoDB','BASE TABLE'])
 const columns=version===1?[]:[[receipt,'address_id','bigint','NO','0',''],[receipt,'creation_request_hash','char','NO','64','ascii_bin'],[receipt,'creation_request_id','char','NO','36','ascii_bin'],[receipt,'member_id','bigint','NO','0',''],['wms_ware_info','creation_request_hash','char','YES','64','ascii_bin'],['wms_ware_info','creation_request_id','char','YES','36','ascii_bin']]
 const indexes=version===1?[['wms_ware_info','PRIMARY','0','1','id','0']]:[[receipt,'PRIMARY','0','1','member_id','0'],[receipt,'PRIMARY','0','2','creation_request_id','0'],['wms_ware_info','PRIMARY','0','1','id','0'],['wms_ware_info','uk_ware_creation_request','0','1','creation_request_id','0']]
 return {tables,columns,indexes,foreignKeys:'0'}
}
const query=data=>statement=>{if(statement.includes('information_schema.tables'))return data.tables.map(r=>r.join('\t')).join('\n');if(statement.includes('information_schema.columns'))return data.columns.map(r=>r.join('\t')).join('\n');if(statement.includes('information_schema.statistics'))return data.indexes.map(r=>r.join('\t')).join('\n');assert(statement.includes('referential_constraints'));return data.foreignKeys}
test('backup structure versions distinguish legacy 71-table backups and the 72-table receipt schema',()=>{
 assert.equal(backupStructureVersion({}),1);for(const version of [1,2])assert.equal(backupStructureVersion({structureVersion:version}),version)
 for(const version of [null,0,3,'2',{},NaN])assert.throws(()=>backupStructureVersion({structureVersion:version}))
 assert.equal(expectedDatabaseTables('demo',1).length,71);assert.equal(expectedDatabaseTables('test',2).length,72);assert.throws(()=>expectedDatabaseTables('test; DROP DATABASE x',2))
})
test('equal table counts cannot disguise unknown names, partial migration or a wrong expected version',()=>{
 assert.deepEqual(inspectDatabaseStructure(query(database(1)),'test',1),{structureVersion:1,tables:71})
 const swapped=database(1);swapped.tables[0][0]='gulimall_pms_test.unrecognized';assert.throws(()=>inspectDatabaseStructure(query(swapped),'test'))
 const partial=database(1);partial.columns.push(['wms_ware_info','creation_request_id','char','YES','36','ascii_bin']);assert.throws(()=>inspectDatabaseStructure(query(partial),'test'))
 assert.throws(()=>inspectDatabaseStructure(query(database(1)),'test',2))
})
test('receipt schema requires binary UUIDs, its member/request key and deletion-independent metadata',()=>{
 assert.deepEqual(inspectDatabaseStructure(query(database(2)),'test',2),{structureVersion:2,tables:72})
 const changed=database(2);changed.columns[2][5]='ascii_general_ci';assert.throws(()=>inspectDatabaseStructure(query(changed),'test'))
 const body=database(2);body.columns.push([receipt,'address_body','text','YES','0','utf8mb4_general_ci']);assert.throws(()=>inspectDatabaseStructure(query(body),'test'))
 const wrongKey=database(2);wrongKey.indexes[1][4]='address_id';assert.throws(()=>inspectDatabaseStructure(query(wrongKey),'test'))
 const cascade=database(2);cascade.foreignKeys='1';assert.throws(()=>inspectDatabaseStructure(query(cascade),'test'))
})
