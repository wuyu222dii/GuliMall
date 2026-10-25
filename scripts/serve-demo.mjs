import {createServer, request} from 'node:http'
import {createReadStream} from 'node:fs'
import {stat} from 'node:fs/promises'
import {resolve, extname, sep} from 'node:path'
import {fileURLToPath} from 'node:url'

export async function createDemoServer({root=resolve('gulimall-web/dist'),port=8080,gatewayPort=88}={}) {
  root=resolve(root)
  await stat(resolve(root,'index.html'))
  const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon','.woff2':'font/woff2'}
  const server=createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin')
    if(req.url==='/api'||req.url.startsWith('/api/')) {
      const headers={...req.headers,host:`127.0.0.1:${gatewayPort}`};delete headers.connection
      const upstream=request({host:'127.0.0.1',port:gatewayPort,path:req.url,method:req.method,headers},reply=>{res.writeHead(reply.statusCode,reply.headers);reply.pipe(res)})
      upstream.setTimeout(30000,()=>upstream.destroy());upstream.on('error',()=>{if(!res.headersSent){res.writeHead(502,{'Content-Type':'application/json'});res.end(JSON.stringify({code:502,msg:'Gateway unavailable. Check the original operation before retrying.'}))}else res.destroy()});req.on('aborted',()=>upstream.destroy());req.pipe(upstream);return
    }
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return}
    try {
      const pathname=decodeURIComponent(req.url.split('?')[0])
      if(pathname.includes('\0')||pathname.split(/[\\/]/).some(part=>part.startsWith('.'))){res.writeHead(404);res.end();return}
      let file=resolve(root,'.'+pathname)
      if(file!==root&&!file.startsWith(root+sep)){res.writeHead(404);res.end();return}
      let entry
      try{entry=await stat(file)}catch{if(extname(pathname)){res.writeHead(404);res.end();return}}
      if(!entry?.isFile()){if(extname(pathname)){res.writeHead(404);res.end();return}file=resolve(root,'index.html');entry=await stat(file)}
      res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Content-Length':entry.size,'Cache-Control':file.endsWith('index.html')?'no-store':'public,max-age=3600'})
      if(req.method==='HEAD')res.end();else createReadStream(file).on('error',()=>res.destroy()).pipe(res)
    }catch{res.writeHead(400);res.end()}
  })
  server.requestTimeout=35000
  await new Promise((accept,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',accept)})
  return server
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  await createDemoServer();console.log('Static demo and same-origin /api ready at http://127.0.0.1:8080 (loopback only).')
}
