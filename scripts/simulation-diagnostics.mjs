import {spawnSync} from 'node:child_process'
import {connect} from 'node:net'
import {resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

const tcp=port=>new Promise(resolve=>{const socket=connect({host:'127.0.0.1',port});const done=value=>{socket.destroy();resolve(value)};socket.setTimeout(1000,()=>done(false));socket.once('error',()=>done(false));socket.once('connect',()=>done(true))})
export async function diagnose({run=(args)=>spawnSync('docker',args,{encoding:'utf8',windowsHide:true,timeout:15000}),request=(url)=>fetch(url,{signal:AbortSignal.timeout(2000)}),probe=tcp,environment=process.env.GULIMALL_TEST==='1'?'Test':'Demo'}={}) {
  const checks=[],project=environment==='Test'?'gulimall-test':'gulimall-demo'
  const add=(name,ok,reason,log,recovery)=>checks.push({name,state:ok?'ready':'unavailable',reason:ok?'就绪':reason,log,recovery})
  const docker=run(['info','--format','{{.OSType}}']);const engine=docker.status===0&&docker.stdout.trim()==='linux'
  add('Docker',engine,'Linux 引擎不可用或查询超时',null,'打开 Docker Desktop，等待 Linux 引擎就绪')
  let containers=[]
  if(engine){const result=run(['compose','ps','--all','--format','json']);try{const raw=result.stdout.trim();containers=raw.startsWith('[')?JSON.parse(raw):raw.split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line))}catch{}}
  for(const name of ['mysql','redis','nacos','elasticsearch','rabbitmq']) {
    const c=containers.find(c=>c.Service===name&&c.Name?.startsWith(project+'-'))
    add(name,!!c&&c.State==='running'&&c.Health==='healthy',engine?'容器停止、未就绪或未找到':'Docker 不可用，无法判断容器','docker compose logs --tail 100 '+name,environment==='Demo'?'./scripts/dev.ps1 Up':'检查独立测试环境日志，不切换到演示库')
  }
  const ports={'product':10001,'member':8000,'coupon':7001,'ware':11000,'order':9000,'search':12000,'auth-server':20000,'third-party':30000,'cart':18000,'gateway':88}
  await Promise.all(Object.entries(ports).map(async([name,port])=>{
    let registered=false
    try{const r=await request('http://127.0.0.1:18848/nacos/v1/ns/instance/list?serviceName=gulimall-'+name+'&healthyOnly=true');const data=await r.json();registered=r.ok&&data.hosts?.filter(h=>h.healthy&&h.ip==='127.0.0.1'&&h.port===port).length===1}catch{}
    const listening=await probe(port)
    add('gulimall-'+name,registered&&listening,!listening?'本机业务端口不可用':'Nacos 健康注册不可确认','.tools/runtime/gulimall-'+name+'.log','./scripts/services.ps1 Start -Modules '+name)
  }))
  for(const [name,url,log]of [['静态入口','http://127.0.0.1:8080/','.tools/static-demo.err.log'],['模拟网关','http://127.0.0.1:18170/health','.tools/simulation/gateway.err.log']]){
    let ready=false;try{const r=await request(url);ready=r.ok;if(name==='模拟网关'){const h=await r.json();ready=ready&&h.mode==='LOCAL_TEST'&&h.ready===true&&h.persistent===true}}catch{}
    add(name,ready,'入口不可用或模拟持久化未就绪',log,environment==='Demo'?'./scripts/simulation.ps1 Start':'检查本次测试入口及模拟网关进程')
  }
  return {mode:'LOCAL_TEST',environment,healthy:checks.every(c=>c.state==='ready'),checks}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const report=await diagnose()
  if(process.argv.includes('--json'))console.log(JSON.stringify(report,null,2))
  else {console.log('模拟环境诊断：'+report.environment);for(const c of report.checks)console.log(`${c.state==='ready'?'通过':'失败'} ${c.name}：${c.reason}${c.state==='ready'?'':`；日志：${c.log||'—'}；恢复：${c.recovery}`}`)}
  process.exitCode=report.healthy?0:1
}
