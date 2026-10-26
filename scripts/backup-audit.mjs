import assert from 'node:assert/strict'
import {readFileSync,realpathSync,existsSync,writeFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {resolve,sep,join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {spawnSync} from 'node:child_process'

export const moneyCents=value=>{assert.match(String(value),/^\d+\.\d{2}$/,'Invalid snapshot amount');return BigInt(String(value).replace('.',''))}
export const requiresReview=(status,inventory,state)=>[6,7,8,9].includes(status)||(status===1&&inventory===0)||(status===4&&(inventory!==2||state!=='TRADE_CLOSED'))||(status===0&&state!=='WAIT_BUYER_PAY')||(state==='TRADE_CLOSED'&&status!==4)
export function verifyDemoBackup(directory) {
  const root=realpathSync(resolve(directory)),manifest=JSON.parse(readFileSync(join(root,'manifest.json'),'utf8'))
  assert.equal(manifest.format,1);assert.equal(manifest.environment,'Demo');assert.equal(manifest.simulationPayments,true,'A simulation ledger is required')
  assert.deepEqual([...manifest.schemas].sort(),['oms','pms','sms','ums','wms'].map(name=>'gulimall_'+name+'_demo').sort())
  assert(Array.isArray(manifest.files));const names=new Set(),fold=value=>process.platform==='win32'?value.toLowerCase():value
  for(const file of manifest.files){assert.equal(typeof file.path,'string');assert(!names.has(fold(file.path)),'Duplicate backup path');names.add(fold(file.path));const path=realpathSync(resolve(root,file.path));assert(fold(path).startsWith(fold(root+sep)),'Backup path escapes source directory');assert.match(file.sha256||'',/^[a-fA-F0-9]{64}$/);assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'),file.sha256.toLowerCase(),'Backup checksum mismatch')}
  for(const file of ['database.sql','redis.rdb','payment-ledger.json'])assert(names.has(file),'Required snapshot is missing: '+file)
  const ledger=JSON.parse(readFileSync(join(root,'payment-ledger.json'),'utf8'));assert.equal(ledger.version,1);assert.match(ledger.publicKeyFingerprint||'',/^[a-f0-9]{64}$/);assert(Array.isArray(ledger.trades))
  const orders=new Set();for(const trade of ledger.trades){assert.match(trade.orderSn||'',/^[a-f0-9]{32}$/);assert(!orders.has(trade.orderSn),'Duplicate ledger order');orders.add(trade.orderSn);moneyCents(trade.amount);assert(['WAIT_BUYER_PAY','TRADE_SUCCESS','TRADE_FINISHED','TRADE_CLOSED'].includes(trade.state))}
  return {root,manifest,ledger}
}
export function auditSnapshot(directory,mysql,redis,reportFile) {
  assert.match(mysql,/^gulimall-audit-[a-f0-9]{32}-mysql$/);assert.equal(redis,mysql.replace(/-mysql$/,'-redis'))
  assert(resolve(reportFile).startsWith(resolve('.tools')+sep)&&!existsSync(reportFile),'Audit reports must use a new private output file')
  const source=verifyDemoBackup(directory)
  const query=input=>{assert(/^SELECT\s/.test(input));const r=spawnSync('docker',['exec','-i',mysql,'sh','-c','MYSQL_PWD="$MYSQL_PASSWORD" exec mysql -ugulimall --batch --skip-column-names'],{input,encoding:'utf8',windowsHide:true});assert.equal(r.status,0,'Isolated audit query failed');return r.stdout.trim()}
  const redisRead=args=>{const r=spawnSync('docker',['exec',redis,'redis-cli','--raw',...args],{encoding:'utf8',windowsHide:true});assert.equal(r.status,0,'Isolated Redis audit failed');return r.stdout.trim()}
  assert.equal(query('SELECT @@global.read_only,@@global.super_read_only;'),'1\t1')
  const denied=spawnSync('docker',['exec','-i',mysql,'sh','-c','MYSQL_PWD="$MYSQL_PASSWORD" exec mysql -ugulimall'],{input:"UPDATE gulimall_oms_demo.oms_order SET note='audit-write-must-fail' WHERE 1=0;",encoding:'utf8',windowsHide:true});assert.notEqual(denied.status,0,'Audit account must not write')
  assert.equal(redisRead(['PING']),'PONG');assert.match(redisRead(['SET','gulimall:audit:must-not-write','x']),/NOPERM/,'Redis audit ACL must reject writes')
  assert.equal(query('SELECT COUNT(*) FROM gulimall_wms_demo.wms_ware_sku WHERE stock<0 OR stock_locked<0 OR stock_locked>stock;'),'0','Invalid inventory bounds')
  assert.equal(query('SELECT COUNT(*) FROM gulimall_oms_demo.oms_order_item i LEFT JOIN gulimall_oms_demo.oms_order o ON o.id=i.order_id WHERE o.id IS NULL;'),'0','Orphan order snapshot')
  assert.equal(query('SELECT COUNT(*) FROM gulimall_oms_demo.oms_order o JOIN (SELECT order_id,SUM(real_amount) amount FROM gulimall_oms_demo.oms_order_item GROUP BY order_id) i ON i.order_id=o.id WHERE i.amount+COALESCE(o.freight_amount,0)<>o.pay_amount;'),'0','Order amount differs from item snapshot')
  const trades=[]
  for(const trade of source.ledger.trades){const rows=query(`SELECT status,inventory_status,CAST(pay_amount AS CHAR) FROM gulimall_oms_demo.oms_order WHERE order_sn='${trade.orderSn}';`).split('\n');assert.equal(rows.length,1);const [status,inventory,amount]=rows[0].split('\t');assert.equal(moneyCents(amount),moneyCents(trade.amount),'Payment amount mismatch');const task=query(`SELECT task_status FROM gulimall_wms_demo.wms_ware_order_task WHERE order_sn='${trade.orderSn}';`);assert.match(task,/^[123]$/,'Missing or duplicate stock work order');if(inventory==='1')assert.equal(task,'3');if(inventory==='2')assert.equal(task,'2');if(['2','3'].includes(status))assert.equal(inventory,'1','Fulfilled order must have settled inventory');if(['1','2','3'].includes(status)){assert.notEqual(inventory,'2','Normal paid order cannot have released inventory');assert(['TRADE_SUCCESS','TRADE_FINISHED'].includes(trade.state),'Normal paid order lacks provider payment')}
    const pending=requiresReview(Number(status),Number(inventory),trade.state)
    trades.push({orderSn:trade.orderSn,paymentState:trade.state,status:Number(status),inventoryStatus:Number(inventory),workOrderStatus:Number(task),amount,pendingReview:pending})
  }
  const images=query("SELECT sku_default_img FROM gulimall_pms_demo.pms_sku_info WHERE sku_default_img LIKE '/api/media/%' UNION SELECT img_url FROM gulimall_pms_demo.pms_sku_images WHERE img_url LIKE '/api/media/%' UNION SELECT img_url FROM gulimall_pms_demo.pms_spu_images WHERE img_url LIKE '/api/media/%';").split('\n').filter(Boolean)
  for(const url of images){assert.match(url,/^\/api\/media\/[a-f0-9]{32}\.(png|jpg)$/);const path='uploads/'+url.split('/').at(-1);assert(source.manifest.files.some(file=>file.path.replaceAll('\\','/')===path),'Referenced image is not checksummed');assert(existsSync(join(source.root,path)),'Referenced local image missing')}
  const countKeys=pattern=>redisRead(['--scan','--pattern',pattern]).split('\n').filter(Boolean).length
  const orderStates=JSON.parse(query("SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT('status',status,'inventoryStatus',inventory_status,'count',n)),JSON_ARRAY()) FROM (SELECT status,inventory_status,COUNT(*) n FROM gulimall_oms_demo.oms_order GROUP BY status,inventory_status) counts;"))
  const workOrderStates=JSON.parse(query("SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT('status',task_status,'count',n)),JSON_ARRAY()) FROM (SELECT task_status,COUNT(*) n FROM gulimall_wms_demo.wms_ware_order_task GROUP BY task_status) counts;"))
  const result={format:1,environment:'Demo',backup:source.root,checkedAt:new Date().toISOString(),checksums:true,temporaryInstances:true,mysqlReadOnly:true,redisReadOnly:true,businessServicesStarted:false,tableCount:Number(query("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema IN ('gulimall_pms_demo','gulimall_sms_demo','gulimall_ums_demo','gulimall_oms_demo','gulimall_wms_demo');")),trades,localImageReferences:images.length,redisKeys:Number(redisRead(['DBSIZE'])),sessionKeys:countKeys('gulimall:session:sessions:*'),cartKeys:countKeys('gulimall:cart:*'),pendingReview:trades.filter(t=>t.pendingReview).length,realServices:false}
  result.orderStates=orderStates;result.workOrderStates=workOrderStates;result.pendingOrders=orderStates.filter(row=>[6,7,8,9].includes(row.status)||[1,4].includes(row.status)&&row.inventoryStatus===0).reduce((sum,row)=>sum+row.count,0)
  verifyDemoBackup(directory);writeFileSync(reportFile,JSON.stringify(result,null,2)+'\n');return result
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv[2]==='verify'){verifyDemoBackup(process.argv[3]);console.log('PASS: Demo backup manifest, paths, hashes and simulation ledger verified')}
  else if(process.argv[2]==='inspect'){const result=auditSnapshot(...process.argv.slice(3));console.log(`PASS: isolated read-only audit; ${result.trades.length} trades, ${result.localImageReferences} image references, pending review ${result.pendingReview}`)}
  else throw new Error('Use scripts/backup-audit.ps1 for an isolated read-only Demo audit')
}
