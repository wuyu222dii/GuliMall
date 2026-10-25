local receipt=redis.call('HGET',KEYS[2],ARGV[1])
if receipt then if receipt~=ARGV[2] then return -3 else return 0 end end
if redis.call('HLEN',KEYS[2]) >= 10000 then return -4 end
local incoming=cjson.decode(ARGV[3])
local size=redis.call('HLEN',KEYS[1])
local updated={}
-- Validate every line before any write; script errors do not roll back prior commands.
for _,line in ipairs(incoming) do
    local sku=tostring(line.skuId)
    local raw=redis.call('HGET',KEYS[1],sku)
    local item=raw and cjson.decode(raw) or {count=0,checked=false}
    if not raw then size=size+1 end
    if size>100 then return -2 end
    item.count=item.count+line.count
    if item.count>999 then return -1 end
    item.checked=item.checked or line.checked
    item.revision=ARGV[4]
    updated[sku]=cjson.encode(item)
end
for sku,item in pairs(updated) do redis.call('HSET',KEYS[1],sku,item) end
redis.call('HSET',KEYS[2],ARGV[1],ARGV[2]); return 1
