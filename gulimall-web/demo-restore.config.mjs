import {defineConfig} from '@playwright/test'
import base from './playwright.config.mjs'
const phase=process.env.GULIMALL_DEMO_RESTORE_PHASE
if(!['prepare','continue'].includes(phase))throw new Error('Use scripts/demo-restore.ps1 for the protected restore browser checks')
export default defineConfig({...base,outputDir:'../output/playwright/demo-restore-'+phase,projects:[{name:'demo-restore',testMatch:'demo-restore.spec.mjs'}]})
