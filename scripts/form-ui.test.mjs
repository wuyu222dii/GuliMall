import test from 'node:test'
import assert from 'node:assert/strict'
import {formSignature} from '../gulimall-web/src/utils/form.js'
test('unsaved forms compare editable values without IDs or transport metadata',()=>{
 const keys=['name','count','status'];assert.equal(formSignature({name:'A',count:1,status:0,id:1},keys),formSignature({name:'A',count:'1',status:'0',id:2,children:[]},keys))
 assert.notEqual(formSignature({name:'B',count:1,status:0},keys),formSignature({name:'A',count:1,status:0},keys));assert.equal(formSignature(null,keys),formSignature({name:'',count:null},keys))
})
