import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,realpathSync,mkdirSync,copyFileSync} from 'node:fs'
import {resolve,join,dirname,sep,basename} from 'node:path'
import {createHash} from 'node:crypto'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {verifyDemoBackup} from './backup-audit.mjs'
import {validatePaymentConfig} from './payment-test-gateway.mjs'
import {paymentLedger} from './simulation-ledger.mjs'
export const hash=value=>createHash('sha256').update(value).digest('hex')
const json=path=>JSON.parse(readFileSync(path,'utf8')),fold=value=>value.toLowerCase().replaceAll('\\','/')
export const hostBindPath=value=>fold(value).replace(/^\/run\/desktop\/mnt\/host\/([a-z])\//,'$1:/')
export function verifyRestoreInput(backup,keyFile){
 const source=verifyDemoBackup(backup),config=json(keyFile);validatePaymentConfig(config);paymentLedger(config,join(source.root,'payment-ledger.json'));return {...source,config}
}
export function descriptor(file){
 const ctx=json(file),source=realpathSync(ctx.source),original=realpathSync(ctx.original)
 assert.equal(ctx.kind,'DemoRestore');assert.match(ctx.project,/^gulimall-handoff-[a-f0-9]{32}$/)
 assert(fold(source).startsWith(fold(join(original,'.tools')+sep))&&basename(source)==='source'&&/^demo restore [a-f0-9]{8}$/.test(basename(dirname(source))),'Restore workspace must be a private child export, never the original workspace')
 assert.equal(fold(realpathSync(file)),fold(join(source,'.tools/demo-restore-context.json')))
 const owner=json(join(source,'.tools/handoff-owner.json'));assert.equal(owner.project,ctx.project);assert.equal(fold(owner.workspace),fold(source))
 return ctx
}
export function docker(args,input){const r=spawnSync('docker',args,{input,encoding:'utf8',windowsHide:true,timeout:120000});assert.equal(r.status,0,'Demo restore Docker operation failed');return r.stdout.trim()}
export function validateEnvironment(ctx,env=process.env){
 assert.notEqual(env.GULIMALL_TEST,'1','The existing Test protection cannot be used for Demo restores');assert.equal(env.COMPOSE_PROJECT_NAME,ctx.project);assert.equal(fold(resolve(env.COMPOSE_FILE||'')),fold(join(ctx.source,'compose.yaml')))
 for(const[key,value]of Object.entries({DB_HOST:'127.0.0.1',DB_PORT:'3307',DB_USER:'gulimall',REDIS_HOST:'127.0.0.1',REDIS_PORT:'6380',NACOS_ADDR:'127.0.0.1:18848',ELASTICSEARCH_URL:'http://127.0.0.1:19200',RABBITMQ_HOST:'127.0.0.1',RABBITMQ_PORT:'5673',AUTH_SMS_MODE:'development',OSS_ENABLED:'false',SMS_ENABLED:'false',IMAGE_STORAGE:'local',NACOS_CONFIG_ENABLED:'false',SPRING_PROFILES_ACTIVE:'dev,payment-test',SPRING_RABBITMQ_VIRTUAL_HOST:'/'}))assert.equal(env[key],value,'Unexpected restore setting: '+key)
 assert.equal(Object.keys(ctx.credentials||{}).length,4)
 for(const[key,digest]of Object.entries(ctx.credentials)){assert.match(digest,/^[a-f0-9]{64}$/);assert(env[key]?.length>=32&&hash(env[key])===digest,'Restore credential does not match the isolated configuration')}
 for(const key of Object.keys(env))if(/^SPRING_/.test(key)&&!['SPRING_PROFILES_ACTIVE','SPRING_RABBITMQ_VIRTUAL_HOST'].includes(key)||['JAVA_TOOL_OPTIONS','JDK_JAVA_OPTIONS','_JAVA_OPTIONS','ORDER_STOCK_URL','WARE_ORDER_EVENT_URL'].includes(key))assert(!env[key],'Unsupported restore override')
 assert.equal(fold(resolve(env.UPLOAD_DIR||'')),fold(join(ctx.source,'.data/uploads')))
 assert.equal(env.ALIPAY_GATEWAY_URL,'http://127.0.0.1:18170/gateway.do');assert.equal(env.ALIPAY_NOTIFY_URL,'http://127.0.0.1:88/api/payments/alipay/notify');assert.equal(env.ALIPAY_RETURN_URL,'http://127.0.0.1:8080/payment/return')
 const config=json(join(ctx.source,'.tools/simulation/payment-config.json'));validatePaymentConfig(config)
 assert(hash(env.ALIPAY_PRIVATE_KEY||'')===hash(config.merchantPrivate)&&hash(env.ALIPAY_PUBLIC_KEY||'')===hash(config.providerPublic),'Restored payment keys differ from the validated copy')
}
export function assertRestoreEnvironment(file=process.env.GULIMALL_DEMO_RESTORE_CONTEXT,{allowStoppedBroker=false,preparing}={}){
 assert(file,'Use scripts/demo-restore.ps1; a restoration context is required')
 const ctx=descriptor(file);validateEnvironment(ctx)
 assert.equal(ctx.originalContainers?.length,5);ctx.originalContainers.forEach(id=>assert.match(id,/^[a-f0-9]{64}$/))
 const originals=JSON.parse(docker(['inspect',...ctx.originalContainers]));assert.equal(originals.length,5)
 for(const old of originals){assert.equal(old.Config.Labels['com.docker.compose.project'],'gulimall-demo');assert.equal(fold(old.Config.Labels['com.docker.compose.project.working_dir']),fold(ctx.original));assert.equal(old.State.Running,false,'Original infrastructure must stay stopped')}
 assert(preparing===undefined||['mysql','redis'].includes(preparing));const names=preparing?[preparing]:['mysql','redis','nacos','elasticsearch','rabbitmq'],containers=JSON.parse(docker(['inspect',...names.map(name=>ctx.project+'-'+name+'-1')]))
 const ports={mysql:[3307],redis:[6380],nacos:[18848,19848],elasticsearch:[19200],rabbitmq:[5673,15673]}
 for(let i=0;i<names.length;i++){
  const c=containers[i],name=names[i];assert.equal(c.Config.Labels['com.docker.compose.project'],ctx.project);assert.equal(fold(c.Config.Labels['com.docker.compose.project.working_dir']),fold(ctx.source));assert(c.State.Running||name==='rabbitmq'&&allowStoppedBroker||preparing==='redis')
  for(const mount of c.Mounts)if(mount.Type==='volume')assert(mount.Name.startsWith(ctx.project+'_'),'Original volumes must never be mounted');else assert(name==='mysql'&&hostBindPath(mount.Source)===fold(join(ctx.source,'.data/empty-init')),'Unexpected host bind')
  for(const bindings of Object.values(c.HostConfig.PortBindings||{}))for(const binding of bindings)assert(binding.HostIp==='127.0.0.1'&&ports[name].includes(Number(binding.HostPort)),'Restore ports must remain isolated loopback bindings')
  const secretKey={mysql:['MYSQL_PASSWORD','DB_PASSWORD'],redis:['REDIS_PASSWORD','REDIS_PASSWORD'],rabbitmq:['RABBITMQ_DEFAULT_PASS','RABBITMQ_PASSWORD']}[name]
  if(secretKey){const value=c.Config.Env.find(e=>e.startsWith(secretKey[0]+'='))?.slice(secretKey[0].length+1);assert(hash(value||'')===ctx.credentials[secretKey[1]],'Container credentials differ from restored services')}
 }
 return ctx
}
export function restoreSql(ctx,query){assert.match(ctx.project,/^gulimall-handoff-[a-f0-9]{32}$/);assert(/^SELECT\s/.test(query));return docker(['exec','-i',ctx.project+'-mysql-1','sh','-c','MYSQL_PWD="$MYSQL_PASSWORD" exec mysql -ugulimall --default-character-set=utf8mb4 --batch --skip-column-names'],query)}
export function prepareFiles(contextFile,backup,keyFile){
 const ctx=descriptor(contextFile),input=verifyRestoreInput(backup,keyFile),uploads=join(ctx.source,'.data/uploads'),ledgerFile=join(ctx.source,'.data/simulation/payment/trades.json'),configFile=join(ctx.source,'.tools/simulation/payment-config.json')
 mkdirSync(uploads,{recursive:true});mkdirSync(dirname(ledgerFile),{recursive:true});mkdirSync(dirname(configFile),{recursive:true})
 const changes=[],ledger=structuredClone(input.ledger),config={...input.config,notifyUrl:'http://127.0.0.1:88/api/payments/alipay/notify',returnUrl:'http://127.0.0.1:8080/payment/return'}
 for(const trade of ledger.trades)for(const[field,value]of Object.entries({notifyUrl:config.notifyUrl,returnUrl:config.returnUrl+'?orderSn='+trade.orderSn})){if(trade[field]!==value)changes.push({orderSn:trade.orderSn,field,before:trade[field],after:value});trade[field]=value}
 for(const file of input.manifest.files.filter(f=>f.path.replaceAll('\\','/').startsWith('uploads/'))){const relative=file.path.replaceAll('\\','/').slice(8),target=resolve(uploads,relative);assert(fold(target).startsWith(fold(uploads+sep)));mkdirSync(dirname(target),{recursive:true});copyFileSync(join(input.root,file.path),target)}
 writeFileSync(configFile,JSON.stringify(config,null,2)+'\n');writeFileSync(ledgerFile,JSON.stringify(ledger,null,2)+'\n');paymentLedger(config,ledgerFile)
 ctx.credentials=Object.fromEntries(['DB_PASSWORD','REDIS_PASSWORD','RABBITMQ_PASSWORD','INTERNAL_API_TOKEN'].map(key=>[key,hash(process.env[key]||'')]))
 writeFileSync(contextFile,JSON.stringify(ctx,null,2)+'\n');writeFileSync(join(ctx.source,'.tools/callback-rebind.json'),JSON.stringify({originalUntouched:true,changes,portReuseRequiresOriginalStopped:true},null,2)+'\n')
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const[action,...args]=process.argv.slice(2)
 if(action==='verify'){verifyRestoreInput(...args);console.log('PASS: Demo manifest, paths, hashes, complete ledger and matching local keys')}
 else if(action==='prepare'){prepareFiles(...args);console.log('PASS: private restore copies prepared; source backup and original keys unchanged')}
 else if(action==='guard'){assertRestoreEnvironment(args[0],{preparing:args[1]});console.log('PASS: restored targets owned, isolated and original infrastructure stopped')}
 else throw new Error('Use scripts/demo-restore.ps1')
}
