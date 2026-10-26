import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs'
import {join,resolve} from 'node:path'
import {randomUUID} from 'node:crypto'
import {spawnSync} from 'node:child_process'
import {testConfig} from './payment-test-gateway.mjs'
import {paymentLedger} from './simulation-ledger.mjs'
import {descriptor,hash,hostBindPath,prepareFiles,validateEnvironment,verifyRestoreInput} from './demo-restore-guard.mjs'

function fixture(){
 const original=resolve('.tools/restore-unit-'+randomUUID()),source=join(original,'.tools/demo restore 1234abcd/source'),backup=join(original,'backup'),key=join(original,'keys.json'),context=join(source,'.tools/demo-restore-context.json')
 mkdirSync(join(source,'.tools'),{recursive:true});mkdirSync(backup,{recursive:true})
 const config=testConfig(key),trade={orderSn:'a'.repeat(32),tradeNo:'RESTORE_UNIT',state:'TRADE_SUCCESS',amount:'0.10',nonce:'b'.repeat(32),notifyId:randomUUID(),notifyAcknowledged:false,paidAt:'2026-10-26 12:00:00',notifyUrl:config.notifyUrl,returnUrl:config.returnUrl+'?orderSn='+'a'.repeat(32)}
 paymentLedger(config,join(backup,'payment-ledger.json')).put(trade)
 writeFileSync(join(backup,'database.sql'),'fixture');writeFileSync(join(backup,'redis.rdb'),'fixture')
 const manifest={format:1,environment:'Demo',simulationPayments:true,schemas:['pms','sms','ums','oms','wms'].map(n=>'gulimall_'+n+'_demo'),files:['database.sql','redis.rdb','payment-ledger.json'].map(path=>({path,sha256:hash(readFileSync(join(backup,path)))}))}
 const save=()=>writeFileSync(join(backup,'manifest.json'),JSON.stringify(manifest));save()
 const ctx={kind:'DemoRestore',original,source,project:'gulimall-handoff-'+'c'.repeat(32)}
 writeFileSync(context,JSON.stringify(ctx));writeFileSync(join(source,'.tools/handoff-owner.json'),JSON.stringify({project:ctx.project,workspace:source}))
 return {backup,key,context,ctx,manifest,save,trade}
}

test('full Demo restore rejects corrupt files, Test manifests and mismatched private keys without mutating its input',()=>{
 const f=fixture(),before=hash(readFileSync(f.key));assert.equal(verifyRestoreInput(f.backup,f.key).ledger.trades.length,1)
 const other=testConfig(join(f.ctx.original,'other-keys.json'));assert(other);assert.throws(()=>verifyRestoreInput(f.backup,join(f.ctx.original,'other-keys.json')),/keys do not match/)
 f.manifest.environment='Test';f.save();assert.throws(()=>verifyRestoreInput(f.backup,f.key));f.manifest.environment='Demo';f.save()
 writeFileSync(join(f.backup,'database.sql'),'corrupt');assert.throws(()=>verifyRestoreInput(f.backup,f.key),/checksum/);assert.equal(hash(readFileSync(f.key)),before)
})

test('restore rebinding touches only private copies and preserves paid state, transaction, retry intent and key fingerprint',()=>{
 const f=fixture(),before=hash(readFileSync(join(f.backup,'payment-ledger.json'))),keys=hash(readFileSync(f.key))
 prepareFiles(f.context,f.backup,f.key)
 const copied=JSON.parse(readFileSync(join(f.ctx.source,'.data/simulation/payment/trades.json'))),original=JSON.parse(readFileSync(join(f.backup,'payment-ledger.json')))
 assert.equal(copied.publicKeyFingerprint,original.publicKeyFingerprint);assert.deepEqual(copied.trades,[{...f.trade,returnUrl:'http://127.0.0.1:8080/payment/return?orderSn='+f.trade.orderSn}]);assert.equal(hash(readFileSync(join(f.backup,'payment-ledger.json'))),before);assert.equal(hash(readFileSync(f.key)),keys)
})

test('Demo restore descriptor and environment refuse original workspace, Test mode, alternate targets and service overrides',()=>{
 assert.equal(hostBindPath('/run/desktop/mnt/host/d/GuliMall/.tools/empty-init'),hostBindPath('D:/GuliMall/.tools/empty-init'));assert.notEqual(hostBindPath('/run/desktop/mnt/host/d/GuliMall/infra/mysql'),hostBindPath('D:/GuliMall/.tools/empty-init'))
 const f=fixture();assert.equal(descriptor(f.context).project,f.ctx.project)
 writeFileSync(f.context,JSON.stringify({...f.ctx,source:f.ctx.original}));assert.throws(()=>descriptor(f.context),/private child export/)
 const config=JSON.parse(readFileSync(f.key)),env={COMPOSE_PROJECT_NAME:f.ctx.project,COMPOSE_FILE:join(f.ctx.source,'compose.yaml'),DB_HOST:'127.0.0.1',DB_PORT:'3307',DB_USER:'gulimall',REDIS_HOST:'127.0.0.1',REDIS_PORT:'6380',NACOS_ADDR:'127.0.0.1:18848',ELASTICSEARCH_URL:'http://127.0.0.1:19200',RABBITMQ_HOST:'127.0.0.1',RABBITMQ_PORT:'5673',AUTH_SMS_MODE:'development',OSS_ENABLED:'false',SMS_ENABLED:'false',IMAGE_STORAGE:'local',NACOS_CONFIG_ENABLED:'false',SPRING_PROFILES_ACTIVE:'dev,payment-test',SPRING_RABBITMQ_VIRTUAL_HOST:'/',UPLOAD_DIR:join(f.ctx.source,'.data/uploads'),ALIPAY_GATEWAY_URL:'http://127.0.0.1:18170/gateway.do',ALIPAY_NOTIFY_URL:config.notifyUrl,ALIPAY_RETURN_URL:'http://127.0.0.1:8080/payment/return',ALIPAY_PRIVATE_KEY:config.merchantPrivate,ALIPAY_PUBLIC_KEY:config.providerPublic}
 f.ctx.credentials={};for(const key of ['DB_PASSWORD','REDIS_PASSWORD','RABBITMQ_PASSWORD','INTERNAL_API_TOKEN']){env[key]='unit-'+randomUUID();f.ctx.credentials[key]=hash(env[key])}
 mkdirSync(join(f.ctx.source,'.tools/simulation'),{recursive:true});writeFileSync(join(f.ctx.source,'.tools/simulation/payment-config.json'),JSON.stringify(config))
 validateEnvironment(f.ctx,env)
 for(const overrides of [{GULIMALL_TEST:'1'},{COMPOSE_PROJECT_NAME:'gulimall-demo'},{DB_HOST:'remote.invalid'},{UPLOAD_DIR:join(f.ctx.original,'.data/uploads')},{SPRING_DATASOURCE_URL:'jdbc:mysql://remote.invalid'},{ALIPAY_GATEWAY_URL:'https://remote.invalid'}])assert.throws(()=>validateEnvironment(f.ctx,{...env,...overrides}))
})

test('existing Test restore refuses Demo backup; Demo restore refuses Test execution before stopping anything',{skip:process.platform!=='win32'},()=>{
 const f=fixture(),env={...process.env,GULIMALL_TEST:'1',COMPOSE_PROJECT_NAME:'gulimall-test'};delete env.PSModulePath
 for(const [script,args,message]of [['restore-drill.ps1',[],/Only verified test backups/],['demo-restore.ps1',['-PaymentConfig',f.key],/Leave isolated Test mode/]]){
  const result=spawnSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File','scripts/'+script,'-Backup',f.backup,...args],{env,encoding:'utf8',windowsHide:true,timeout:30000})
  assert.notEqual(result.status,0);assert.match(result.stderr,message);assert.doesNotMatch(result.stdout,/Started|Stopped|Created/)
 }
})
