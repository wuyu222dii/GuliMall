local operation, sku = ARGV[1], ARGV[2]
if operation == 'clear' then redis.call('DEL',KEYS[1]); return 1 end
if operation == 'remove' then redis.call('HDEL',KEYS[1],sku); return 1 end
local raw = redis.call('HGET',KEYS[1],sku)
local item = raw and cjson.decode(raw) or {count=0,checked=true}
if operation == 'add' then
    if not raw and redis.call('HLEN',KEYS[1]) >= 100 then return -2 end
    item.count = item.count + tonumber(ARGV[3])
    if item.count > 999 then return -1 end
elseif not raw then return -5
elseif operation == 'count' then item.count=tonumber(ARGV[3])
elseif operation == 'check' then item.checked=(ARGV[3]=='true')
else return -6 end
item.revision=ARGV[4]
redis.call('HSET',KEYS[1],sku,cjson.encode(item)); return 1
