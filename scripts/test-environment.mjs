import assert from 'node:assert/strict'
export async function assertTestEnvironment() {
  assert.equal(process.env.GULIMALL_TEST, '1', 'Use scripts/test.ps1; demo and live environments are forbidden.')
  assert.equal(process.env.COMPOSE_PROJECT_NAME, 'gulimall-test')
  assert(process.env.SPRING_PROFILES_ACTIVE?.split(',').includes('test'))
  assert(process.env.INTERNAL_API_TOKEN?.length >= 32)
  for (const [port, schema] of [[10001, 'pms'], [7001, 'sms'], [8000, 'ums'], [9000, 'oms'], [11000, 'wms']]) {
    const r = await fetch(`http://127.0.0.1:${port}/internal/test-environment`, { headers: { 'X-Internal-Token': process.env.INTERNAL_API_TOKEN }, signal: AbortSignal.timeout(5000) })
    assert.equal(r.status, 200, 'Test profile required on every database service')
    assert.equal((await r.json()).catalog, `gulimall_${schema}_test`, 'Refusing to test a non-test database')
  }
}
