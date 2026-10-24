import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const read = (name) => readFileSync(path.join(root, name), 'utf8')
const schema = read('infra/mysql/001-schema.sql')
const databases = new Map()
let database
for (const statement of schema.split(';')) {
  const use = statement.match(/USE `(\w+)`/)
  if (use) {
    database = use[1]
    databases.set(database, new Map())
  }
  const table = statement.match(/CREATE TABLE `(\w+)` \(([\s\S]+)\) ENGINE=InnoDB/)
  if (table) {
    assert.ok(database?.endsWith('_demo'))
    databases.get(database).set(table[1], new Set([...table[2].matchAll(/^  `(\w+)` /gm)].map((m) => m[1])))
  }
}
const entities = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const name = path.join(dir, entry.name)
  return entry.isDirectory() ? entities(name) : entry.name.endsWith('Entity.java') ? [name] : []
})

test('all mapped entities and persistent fields have matching demo tables', () => {
  const modules = { product: 'pms', coupon: 'sms', member: 'ums', order: 'oms', ware: 'wms' }
  let count = 0
  for (const [module, suffix] of Object.entries(modules)) {
    const tables = databases.get(`gulimall_${suffix}_demo`)
    assert.ok(tables)
    for (const file of entities(path.join(root, `gulimall-${module}/src/main/java`))) {
      const source = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '')
      const table = source.match(/@TableName\("(\w+)"\)/)?.[1]
      if (!table) continue
      assert.ok(tables.has(table), `${file}: missing table`)
      for (const declaration of source.split(';')) {
        const field = declaration.match(/private\s+[\w<>[\],?]+\s+(\w+)\s*$/)?.[1]
        if (!field || /@TableField\(exist\s*=\s*false\)/.test(declaration)) continue
        const column = declaration.match(/@Table(?:Id|Field)\("(\w+)"\)/)?.[1] || field.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
        assert.ok(tables.get(table).has(column), `${table}.${column} missing`)
      }
      count++
    }
  }
  assert.equal(count, 68)
})

test('seed inserts only target known demo tables and columns', () => {
  let current
  let inserts = 0
  for (const statement of read('infra/mysql/002-demo.sql').split(';')) {
    const use = statement.match(/USE (\w+)/)
    if (use) current = use[1]
    const insert = statement.match(/INSERT INTO (\w+)\s*\(([^)]+)\)/)
    if (!insert) continue
    const columns = databases.get(current)?.get(insert[1])
    assert.ok(columns, `Unknown seed table ${current}.${insert[1]}`)
    for (const column of insert[2].split(',').map((c) => c.trim())) {
      assert.ok(columns.has(column), `Unknown seed column ${insert[1]}.${column}`)
    }
    inserts++
  }
  assert.ok(inserts >= 15)
  assert.match(read('infra/mysql/002-demo.sql'), /'demo_a'.*'\$2a\$10\$/)
  assert.match(read('infra/mysql/002-demo.sql'), /'demo_b'.*'\$2a\$10\$/)
  assert.doesNotMatch(schema, /DROP\s|TRUNCATE\s|IF NOT EXISTS/i)
})

test('database configuration defaults to isolated demo databases without a password fallback', () => {
  for (const module of ['product', 'coupon', 'member', 'order', 'ware']) {
    const config = read(`gulimall-${module}/src/main/resources/application.yml`)
    assert.match(config, /password: \$\{DB_PASSWORD\}/)
    assert.match(config, /gulimall_\w+_demo\?/)
    assert.doesNotMatch(config, /password: (?!\$\{)\S+/)
  }
  assert.match(read('.gitignore'), /^\.env$/m)
  assert.match(read('.gitignore'), /^\.data\/$/m)
})
