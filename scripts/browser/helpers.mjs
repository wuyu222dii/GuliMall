import {expect} from '../../gulimall-web/node_modules/@playwright/test/index.mjs'
import {spawnSync} from 'node:child_process'
import assert from 'node:assert/strict'
import {randomUUID,randomInt} from 'node:crypto'
import {saveSafeTrace} from '../browser-artifacts.mjs'
export const base='http://127.0.0.1:8080'
export async function json(page,path){const r=await page.request.get(base+path);expect(r.status()).toBe(200);return r.json()}
export function sql(query){assert(/^SELECT\s/.test(query));const r=spawnSync('docker',['compose','exec','-T','mysql','sh','-c','MYSQL_PWD="$MYSQL_PASSWORD" exec mysql -ugulimall --batch --skip-column-names'],{input:query,encoding:'utf8',windowsHide:true});assert.equal(r.status,0,'Read-only test assertion failed');return r.stdout.trim()}
export async function login(page,account){try{await page.goto('/admin/login');await page.getByLabel('管理员账号',{exact:true}).fill(account.username);await page.getByLabel('密码',{exact:true}).fill(account.password);await page.getByRole('button',{name:'登录',exact:true}).click();await expect(page.getByRole('heading',{name:'商品列表',exact:true})).toBeVisible()}catch{throw new Error('测试管理员登录失败（敏感输入已隐藏）')}}
export async function signIn(page,account){try{await page.getByLabel('用户名或手机号',{exact:true}).fill(account.username);await page.getByLabel('密码',{exact:true}).fill(account.password);await page.getByRole('button',{name:'登录',exact:true}).click();await expect(page.getByRole('button',{name:'退出登录',exact:true})).toBeVisible()}catch{throw new Error('测试会员登录失败（敏感输入已隐藏）')}}
export async function register(page,username,password='Browser_'+randomUUID().slice(0,12)+'!'){
 try{
  await page.goto('/register');await page.getByLabel('用户名',{exact:true}).fill(username);await page.getByLabel('手机号',{exact:true}).fill('136'+String(randomInt(100000000)).padStart(8,'0'))
  await page.getByRole('button',{name:'获取验证码',exact:true}).click();const message=await page.getByRole('status').filter({hasText:'开发验证码：'}).innerText(),code=message.match(/开发验证码：(\d{6})/)[1]
  await page.getByLabel('验证码',{exact:true}).fill(code);await page.getByLabel('密码',{exact:true}).fill(password);await page.getByRole('button',{name:'注册',exact:true}).click();await expect(page.getByRole('button',{name:'退出登录',exact:true})).toBeVisible();return(await json(page,'/api/auth/me')).user.id
 }catch{throw new Error('开发验证码注册失败（密码与验证码已隐藏）')}
}
export async function fits(page){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)}
export async function openPage(browser,contexts){
 const c=await browser.newContext({baseURL:base,viewport:{width:1280,height:800}});contexts.push(c)
 await c.route('**/*',route=>{const url=new URL(route.request().url());return ['http:','https:'].includes(url.protocol)&&url.hostname!=='127.0.0.1'?route.abort():route.continue()})
 await c.tracing.start({screenshots:false,snapshots:false,sources:false});return c.newPage()
}
export async function closeContexts(contexts,info){
 const failed=info.status!==info.expectedStatus
 for(let i=0;i<contexts.length;i++){
  if(failed)for(const [j,page]of contexts[i].pages().entries())try{if(!page.isClosed())await page.screenshot({path:info.outputPath(`failure-${i}-${j}.png`),fullPage:true,mask:[page.locator('input'),page.locator('[role="status"]')]})}catch{/* A closed page cannot be captured. */}
  try{if(failed){const raw=info.outputPath('raw-'+i+'.zip');await contexts[i].tracing.stop({path:raw});saveSafeTrace(raw,info.outputPath('trace-'+i+'.zip'))}else await contexts[i].tracing.stop()}finally{await contexts[i].close()}
 }
}
