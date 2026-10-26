import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs'
import {randomUUID,createHash} from 'node:crypto'
import {createServer} from 'node:net'
import {spawnSync} from 'node:child_process'
import {resolve} from 'node:path'
import {verifyDemoBackup,moneyCents,auditSnapshot,requiresReview} from './backup-audit.mjs'
function fixture(){
  const root='.tools/backup-audit-'+randomUUID();mkdirSync(root,{recursive:true})
  const ledger={version:1,publicKeyFingerprint:'a'.repeat(64),trades:[{orderSn:'b'.repeat(32),amount:'3.75',state:'TRADE_SUCCESS'}]}
  for(const[file,data]of Object.entries({'database.sql':'fixture','redis.rdb':'snapshot','payment-ledger.json':JSON.stringify(ledger)}))writeFileSync(root+'/'+file,data)
  const manifest={format:1,environment:'Demo',simulationPayments:true,schemas:['pms','sms','ums','oms','wms'].map(name=>'gulimall_'+name+'_demo'),files:['database.sql','redis.rdb','payment-ledger.json'].map(path=>({path,sha256:createHash('sha256').update(readFileSync(root+'/'+path)).digest('hex')}))}
  const save=()=>writeFileSync(root+'/manifest.json',JSON.stringify(manifest));save();return {root,manifest,save}
}
test('Demo audit rejects corrupt, escaping or incomplete backups before any instance operation',()=>{
  const {root,manifest,save}=fixture();assert.equal(verifyDemoBackup(root).ledger.trades.length,1)
  assert.throws(()=>auditSnapshot(root,'gulimall-demo-mysql-1','gulimall-demo-redis-1',root+'/result.json'))
  writeFileSync(root+'/database.sql','changed');assert.throws(()=>verifyDemoBackup(root),/checksum/);writeFileSync(root+'/database.sql','fixture')
  writeFileSync(root+'-outside.txt','outside');manifest.files.push({path:'../'+root.split('/').at(-1)+'-outside.txt',sha256:'0'.repeat(64)});save();assert.throws(()=>verifyDemoBackup(root),/escapes/);manifest.files.pop()
  manifest.environment='Test';save();assert.throws(()=>verifyDemoBackup(root));manifest.environment='Demo';manifest.simulationPayments=false;save();assert.throws(()=>verifyDemoBackup(root),/ledger/)
})
test('audit refuses an occupied restore port without stopping its owner',{skip:process.platform!=='win32'},async()=>{
  const {root}=fixture(),server=createServer();let listening=false
  await new Promise((resolve,reject)=>{server.once('error',error=>error.code==='EADDRINUSE'?resolve():reject(error));server.listen(3317,'127.0.0.1',()=>{listening=true;resolve()})})
  try{const env={...process.env};delete env.PSModulePath;delete env.GULIMALL_TEST
    const child=spawnSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File','scripts/backup-audit.ps1','-Backup',resolve(root)],{env,encoding:'utf8',windowsHide:true,timeout:30000})
    assert.notEqual(child.status,0);assert.match(child.stderr,/Audit port 3317 is occupied/);assert.doesNotMatch(child.stdout,/gulimall-audit-[a-f0-9]{32}-mysql/);if(listening)assert(server.listening)
  }finally{if(listening)await new Promise(resolve=>server.close(resolve))}
})
test('audit amount comparisons preserve cents without floating point rounding',()=>{
  assert.equal(moneyCents('0.10')*3n+moneyCents('3.45'),375n);assert.equal(moneyCents('999999999999999999.99'),99999999999999999999n)
  for(const value of ['-1.00','1.001','NaN',null,'1e3','0.1'])assert.throws(()=>moneyCents(value))
})
test('pending and exceptional snapshots remain visible instead of being repaired or counted as settled',()=>{
  for(const [status,inventory,state]of [[1,0,'TRADE_SUCCESS'],[4,0,'TRADE_CLOSED'],[6,0,'WAIT_BUYER_PAY'],[8,0,'TRADE_CLOSED'],[9,2,'TRADE_SUCCESS'],[0,0,'TRADE_SUCCESS'],[4,2,'TRADE_SUCCESS']])assert.equal(requiresReview(status,inventory,state),true)
  for(const [status,inventory,state]of [[0,0,'WAIT_BUYER_PAY'],[1,1,'TRADE_SUCCESS'],[3,1,'TRADE_SUCCESS'],[4,2,'TRADE_CLOSED']])assert.equal(requiresReview(status,inventory,state),false)
})
