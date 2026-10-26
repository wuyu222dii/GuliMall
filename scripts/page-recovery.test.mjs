import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {readFileSync} from 'node:fs'
const require=createRequire(new URL('../gulimall-web/package.json',import.meta.url))
test('a render failure preserves data and offers safe reload without echoing exception details',async()=>{
  const {transform}=require('esbuild'),React=require('react'),module={exports:{}}
  const source=readFileSync(new URL('../gulimall-web/src/components/PageErrorBoundary.jsx',import.meta.url),'utf8')
  const {code}=await transform(source,{loader:'jsx',format:'cjs',jsx:'automatic'});let reloads=0
  new Function('require','module','exports','window',code)(require,module,module.exports,{location:{reload:()=>reloads++}})
  const Boundary=module.exports.default,child=React.createElement('p',null,'正常内容'),boundary=new Boundary({children:child})
  assert.equal(boundary.render(),child)
  boundary.state=Boundary.getDerivedStateFromError(new Error('private-exception-details'))
  const fallback=boundary.render(),serialized=JSON.stringify(fallback)
  assert.equal(fallback.props.role,'alert');assert(serialized.includes('原有购物车和订单请求已保留'));assert(!serialized.includes('private-exception-details'))
  const controls=fallback.props.children.find(element=>element.type==='div').props.children
  controls.find(element=>element.type==='button').props.onClick();assert.equal(reloads,1);assert.equal(controls.find(element=>element.type==='a').props.href,'/')
})
