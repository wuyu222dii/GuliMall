import test from 'node:test'
import assert from 'node:assert/strict'
import { prepareRecoveryReceipts, verifyRecoveryReceipts } from './recovery-receipts.mjs'

test('recovery receipt fixtures refuse an ordinary Demo or unknown environment before any HTTP write', async () => {
  const old = { test: process.env.GULIMALL_TEST, context: process.env.GULIMALL_DEMO_RESTORE_CONTEXT }
  let calls = 0
  const client = { call() { calls++; throw new Error('Unsafe request') } }
  try {
    delete process.env.GULIMALL_TEST; delete process.env.GULIMALL_DEMO_RESTORE_CONTEXT
    await assert.rejects(prepareRecoveryReceipts(client, client, 1)); await assert.rejects(verifyRecoveryReceipts(client, client, {})); assert.equal(calls, 0)
  } finally {
    if (old.test === undefined) delete process.env.GULIMALL_TEST; else process.env.GULIMALL_TEST = old.test
    if (old.context === undefined) delete process.env.GULIMALL_DEMO_RESTORE_CONTEXT; else process.env.GULIMALL_DEMO_RESTORE_CONTEXT = old.context
  }
})
