import test from 'node:test'
import assert from 'node:assert/strict'
import {parseCreationReference,creationFingerprint} from '../gulimall-web/src/utils/creation.js'
test('creation references contain only a lowercase UUID and fingerprint, never form bodies',()=>{
 const reference={requestId:'a2aba713-7b70-4eed-9ae4-0062e34082cc',fingerprint:'a'.repeat(64)}
 assert.deepEqual(parseCreationReference(JSON.stringify(reference)),reference);assert.equal(parseCreationReference(null),null)
 for(const changed of [{...reference,body:{name:'private address'}},{...reference,requestId:reference.requestId.toUpperCase()},{...reference,fingerprint:''},[],{},null])assert.throws(()=>parseCreationReference(JSON.stringify(changed)))
})
test('local fingerprints bind the submitted fields and their order without retaining the body',async()=>{
 const address={name:'收件人',phone:'13800000001',detailAddress:'原地址',defaultStatus:0},fields=Object.keys(address),fingerprint=await creationFingerprint(address,fields)
 assert.match(fingerprint,/^[a-f0-9]{64}$/);assert.equal(await creationFingerprint({...address,id:99},fields),fingerprint)
 assert.notEqual(await creationFingerprint({...address,detailAddress:'另一地址'},fields),fingerprint)
 assert.notEqual(await creationFingerprint(address,[...fields].reverse()),fingerprint)
 assert.deepEqual(address,{name:'收件人',phone:'13800000001',detailAddress:'原地址',defaultStatus:0})
})
