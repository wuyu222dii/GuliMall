import test from 'node:test'
import assert from 'node:assert/strict'
import { catalogCategories, catalogRows } from '../gulimall-web/src/utils/catalog.js'
const filter={key:'',catalogId:'',status:'',type:''}
test('catalog category paths preserve tree ancestry and stable sibling order without mutating metadata',()=>{
 const categories=[{catId:2,name:'B',sort:0,children:[]},{catId:1,name:'A',sort:0,children:[{catId:4,name:'Child',sort:0,children:[{catId:5,name:'Leaf'}]}]}],original=structuredClone(categories)
 assert.deepEqual(catalogCategories(categories).map(r=>r.catId),[1,4,5,2]);assert.equal(catalogCategories(categories)[2].path,'A / Child / Leaf');assert.deepEqual(categories,original)
 assert.deepEqual(catalogRows({categories},'categories',{...filter,key:'5'}).map(r=>r.catId),[5]);assert.equal(catalogRows({categories},'categories',{...filter,key:'child'}).length,1)
})
test('catalog queries combine names IDs category status and attribute type including zero',()=>{
 const meta={brands:[{brandId:2,name:'Demo',showStatus:0},{brandId:1,name:'Demo Plus',showStatus:1}],attrs:[{attrId:3,attrName:'Size',catelogId:10,enable:0,attrType:0},{attrId:2,attrName:'Size',catelogId:11,enable:1,attrType:1}],groups:[{attrGroupId:4,attrGroupName:'Group',catelogId:10}]},original=structuredClone(meta)
 assert.deepEqual(catalogRows(meta,'brands',{...filter,key:' DEMO '}).map(r=>r.brandId),[1,2]);assert.equal(catalogRows(meta,'brands',{...filter,status:'0'})[0].brandId,2)
 assert.equal(catalogRows(meta,'attrs',{...filter,key:'size',catalogId:'10',status:'0',type:'0'})[0].attrId,3)
 assert.equal(catalogRows(meta,'attrs',{...filter,catalogId:'11',type:'0'}).length,0);assert.equal(catalogRows(meta,'groups',{...filter,key:'4',catalogId:'10'}).length,1);assert.deepEqual(meta,original)
 assert.deepEqual(catalogRows(null,'brands',filter),[])
})
