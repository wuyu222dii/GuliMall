-- A completed order is applied once; never remove a line changed after confirmation.
local receipt=redis.call('HGET',KEYS[2],ARGV[1])
if receipt then if receipt~=ARGV[2] then return -3 else return 0 end end
local lines=cjson.decode(ARGV[2])
for _,line in ipairs(lines) do
    local raw=redis.call('HGET',KEYS[1],line.skuId)
    if raw then
        local item=cjson.decode(raw)
        if (item.revision or raw)==line.revision then redis.call('HDEL',KEYS[1],line.skuId) end
    end
end
redis.call('HSET',KEYS[2],ARGV[1],ARGV[2]); return 1
