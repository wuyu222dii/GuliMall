local previous=redis.call('HGET',KEYS[2],ARGV[1])
if previous then
    if cjson.decode(previous).hash~=ARGV[2] then return -7 else return 0 end
end
if redis.call('HLEN',KEYS[2])>=10000 then return -8 end
local raw=redis.call('HGET',KEYS[1],ARGV[3])
if not raw and redis.call('HLEN',KEYS[1])>=100 then return -2 end
local item=raw and cjson.decode(raw) or {count=0,checked=true}
item.count=item.count+tonumber(ARGV[4])
if item.count>999 then return -1 end
item.revision=ARGV[5]
-- Encode and validate before writing: Lua errors do not roll back earlier Redis commands.
local updated=cjson.encode(item)
local receipt=cjson.encode({hash=ARGV[2],skuId=ARGV[3],count=tonumber(ARGV[4])})
redis.call('HSET',KEYS[1],ARGV[3],updated)
redis.call('HSET',KEYS[2],ARGV[1],receipt)
return 1
