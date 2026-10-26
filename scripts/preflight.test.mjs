import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdirSync,copyFileSync,writeFileSync,readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {randomUUID} from 'node:crypto'
import {spawnSync} from 'node:child_process'
const shell=(root,code,extra={})=>{const env={...process.env,...extra};delete env.PSModulePath;return spawnSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-Command',code],{cwd:root,env,windowsHide:true,encoding:'utf8',timeout:45000})}
const fixture=()=>{const root=resolve('.tools/preflight-'+randomUUID());mkdirSync(root+'/scripts',{recursive:true});for(const file of ['env.ps1','preflight.ps1','setup.ps1'])copyFileSync('scripts/'+file,root+'/scripts/'+file);copyFileSync('.env.example',root+'/.env.example');return root}
test('configuration rejects duplicates, unbalanced quotes and malformed lines before loading any values',{skip:process.platform!=='win32'},()=>{
 const root=fixture()
 for(const body of ['TASK_FRESH=must-not-load\nTASK_FRESH=duplicate','TASK_FRESH=must-not-load\nBROKEN','TASK_FRESH=must-not-load\nTASK_OTHER=\'unfinished']){
  writeFileSync(root+'/.env',body)
  const result=shell(root,"try { . ./scripts/env.ps1; throw 'accepted invalid input' } catch { if ($env:TASK_FRESH) { throw 'partially loaded configuration' }; if ($_.Exception.Message -eq 'accepted invalid input') { throw }; Write-Output 'PASS' }")
  assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/PASS/)
 }
})
test('preflight reports missing tools and secrets without changing files, exposing values or starting services',{skip:process.platform!=='win32'},()=>{
 const root=fixture(),secret='private-preflight-'+randomUUID();writeFileSync(root+'/.env','DB_PASSWORD='+secret+'\n')
 const before=readFileSync(root+'/.env','utf8'),result=shell(root,'& ./scripts/preflight.ps1 -Mode Build -Json',{JAVA_HOME:root+'/missing-jdk',MYSQL_ROOT_PASSWORD:'',REDIS_PASSWORD:'',RABBITMQ_PASSWORD:'',INTERNAL_API_TOKEN:'',Path:process.env.SystemRoot+'/System32;'+process.env.SystemRoot+'/System32/WindowsPowerShell/v1.0'})
 assert.notEqual(result.status,0);const report=JSON.parse(result.stdout);assert.equal(report.ready,false);for(const name of ['configuration','JDK','mvn','node','npm'])assert.equal(report.checks.find(c=>c.name===name).ready,false);assert.doesNotMatch(result.stdout,new RegExp(secret));assert.doesNotMatch(result.stdout,/Started|Stopped/);assert.equal(readFileSync(root+'/.env','utf8'),before)
})
test('handoff runtime guard refuses the ordinary demonstration workspace before any network or database operation',()=>{
 const env={...process.env};delete env.GULIMALL_TEST;env.COMPOSE_PROJECT_NAME='gulimall-demo'
 const child=spawnSync(process.execPath,['scripts/handoff.acceptance.mjs'],{env,windowsHide:true,encoding:'utf8',timeout:10000})
 assert.notEqual(child.status,0);assert.match(child.stderr,/handoff-owner/)
})
