import {defineConfig} from '@playwright/test'
export default defineConfig({
  testDir:'../scripts/browser',outputDir:'../output/playwright',workers:1,fullyParallel:false,retries:0,maxFailures:1,timeout:240000,
  reporter:[['list']],expect:{timeout:20000},use:{browserName:'chromium',headless:true,viewport:{width:1280,height:800},baseURL:'http://127.0.0.1:8080',actionTimeout:20000,navigationTimeout:30000,trace:'off',screenshot:'off',video:'off'},
  projects:[{name:'chromium',testMatch:['trade.spec.mjs','pages.spec.mjs','procurement.spec.mjs','admin.spec.mjs']},{name:'edge',testMatch:['edge.spec.mjs','pages.spec.mjs','procurement.spec.mjs','admin.spec.mjs'],use:{channel:'msedge'}}],
})
