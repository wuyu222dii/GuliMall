import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {readFileSync,writeFileSync,readdirSync,mkdirSync,unlinkSync,rmSync,existsSync} from 'node:fs'
import {resolve,dirname,join,sep} from 'node:path'
import {randomUUID} from 'node:crypto'

// Keep action timing only: DOM snapshots, network bodies and typed values can contain authentication secrets.
export function safeTraceEvent(event) {
  if(!['context-options','before','after','input'].includes(event.type))return null
  const safe={}
  for(const key of ['type','version','origin','sdkLanguage','browserName','platform','wallTime','monotonicTime','callId','startTime','endTime','apiName','class','method','pageId','parentId','stepId'])if(['string','number','boolean'].includes(typeof event[key]))safe[key]=event[key]
  if(event.type==='before')safe.params={}
  if(event.type==='context-options')safe.options={viewport:event.options?.viewport}
  if(event.error)safe.error={name:'Error',message:'操作失败，详细业务结果请查看脱敏截图及场景摘要。'}
  return safe
}
export function saveSafeTrace(source,destination) {
  const root=resolve('output/playwright')+sep,inside=path=>assert(resolve(path).startsWith(root),'Browser artifacts must stay inside output/playwright')
  inside(source);inside(destination)
  const temp=join(dirname(destination),'.trace-'+randomUUID());inside(temp);mkdirSync(temp,{recursive:true})
  const quote=value=>"'"+resolve(value).replaceAll("'","''")+"'",env={...process.env};delete env.PSModulePath
  const zip=command=>{const r=spawnSync('powershell.exe',['-NoProfile','-Command','Add-Type -AssemblyName System.IO.Compression.FileSystem; '+command],{env,stdio:'ignore',windowsHide:true,timeout:30000});assert.equal(r.status,0,'Trace archive operation failed')}
  try {
    zip(`[IO.Compression.ZipFile]::ExtractToDirectory(${quote(source)},${quote(temp)})`)
    const scrub=dir=>{for(const f of readdirSync(dir,{withFileTypes:true})){const path=join(dir,f.name);if(f.isDirectory())scrub(path);else if(f.name.endsWith('.trace')){const events=readFileSync(path,'utf8').split('\n').filter(Boolean).map(line=>safeTraceEvent(JSON.parse(line))).filter(Boolean);writeFileSync(path,events.map(e=>JSON.stringify(e)).join('\n')+'\n')}else if(f.name.endsWith('.network'))writeFileSync(path,'');else unlinkSync(path)}}
    scrub(temp);if(existsSync(destination))unlinkSync(destination)
    zip(`[IO.Compression.ZipFile]::CreateFromDirectory(${quote(temp)},${quote(destination)})`)
  } finally {inside(temp);rmSync(temp,{recursive:true,force:true});if(existsSync(source))unlinkSync(source)}
}
export function cleanRawBrowserArtifacts() {
  const root=resolve('output/playwright'),inside=path=>assert(resolve(path).startsWith(root+sep),'Unexpected browser artifact path')
  if(!existsSync(root))return
  const walk=dir=>{for(const file of readdirSync(dir,{withFileTypes:true})){const path=join(dir,file.name);inside(path);if(file.isDirectory()){if(file.name.startsWith('.playwright-artifacts-'))rmSync(path,{recursive:true,force:true});else walk(path)}else if(file.name==='error-context.md'||/^raw-\d+\.zip$/.test(file.name))unlinkSync(path)}}
  walk(root)
}
