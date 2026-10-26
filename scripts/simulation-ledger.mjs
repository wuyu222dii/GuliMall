import assert from 'node:assert/strict'
import {createHash,randomUUID} from 'node:crypto'
import {existsSync,readFileSync,mkdirSync,openSync,writeFileSync,fsyncSync,closeSync,renameSync,unlinkSync} from 'node:fs'
import {dirname} from 'node:path'

// shortcut: one local gateway owns this small ledger; use a database before supporting multiple gateway processes.
export function paymentLedger(config,file) {
  const fingerprint=createHash('sha256').update(config.merchantPublic+'\n'+config.providerPublic).digest('hex')
  const validate=trade=>{
    assert.match(trade.orderSn||'',/^[a-f0-9]{32}$/)
    assert.match(trade.tradeNo||'',/^[A-Za-z0-9_-]{1,128}$/)
    assert(['WAIT_BUYER_PAY','TRADE_SUCCESS','TRADE_FINISHED','TRADE_CLOSED'].includes(trade.state))
    assert.match(trade.amount||'',/^\d{1,18}\.\d{2}$/)
    assert.equal(typeof trade.nonce,'string');assert(trade.nonce.length>=32)
  }
  let initial=[]
  if(file&&existsSync(file)) {
    const data=JSON.parse(readFileSync(file,'utf8'))
    assert.equal(data.version,1,'Unsupported payment ledger version')
    assert.equal(data.publicKeyFingerprint,fingerprint,'Payment ledger keys do not match; restore the original private configuration')
    assert(Array.isArray(data.trades));data.trades.forEach(validate)
    assert.equal(new Set(data.trades.map(t=>t.orderSn)).size,data.trades.length,'Duplicate ledger orders')
    initial=data.trades
  }
  const trades=new Map(initial.map(trade=>[trade.orderSn,trade]))
  const put=trade=>{
    if(file) {
      validate(trade)
      const next=new Map(trades);next.set(trade.orderSn,trade)
      mkdirSync(dirname(file),{recursive:true})
      const temporary=file+'.'+randomUUID()+'.tmp';let fd
      try {
        fd=openSync(temporary,'wx',0o600)
        writeFileSync(fd,JSON.stringify({version:1,publicKeyFingerprint:fingerprint,trades:[...next.values()]},null,2)+'\n');fsyncSync(fd);closeSync(fd);fd=undefined
        renameSync(temporary,file)
      } finally {if(fd!==undefined)closeSync(fd);if(existsSync(temporary))unlinkSync(temporary)}
    }
    trades.set(trade.orderSn,trade);return trade
  }
  return {trades,put}
}
