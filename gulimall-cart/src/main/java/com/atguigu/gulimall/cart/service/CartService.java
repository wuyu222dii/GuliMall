package com.atguigu.gulimall.cart.service;

import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.TypeReference;
import com.atguigu.common.security.ApiProblem;
import com.atguigu.common.to.CartProductTo;
import com.atguigu.common.utils.R;
import com.atguigu.gulimall.cart.feign.ProductFeignService;
import com.atguigu.gulimall.cart.vo.*;
import org.springframework.beans.BeanUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ClassPathResource;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class CartService {
    @Autowired private StringRedisTemplate redis;
    @Autowired private ProductFeignService products;
    private final DefaultRedisScript<Long> mutate = script("mutate");
    private final DefaultRedisScript<Long> merge = script("merge");
    private final DefaultRedisScript<Long> ordered = script("ordered");
    private final DefaultRedisScript<Long> addition = script("addition");
    private static DefaultRedisScript<Long> script(String name) {
        DefaultRedisScript<Long> result = new DefaultRedisScript<>(); result.setLocation(new ClassPathResource("cart/"+name+".lua")); result.setResultType(Long.class); return result;
    }
    private String key(long memberId) { if (memberId < 1) throw new ApiProblem(403,"会员身份不正确"); return "gulimall:cart:{"+memberId+"}:items"; }
    public static void validate(CartInput item, boolean quantity) {
        if (item == null || item.getSkuId() == null || item.getSkuId() < 1 || quantity && (item.getCount() == null || item.getCount() < 1 || item.getCount() > 999)) throw new ApiProblem(400,"SKU 或数量不正确，数量须为 1–999 的整数");
    }
    private long execute(DefaultRedisScript<Long> script, List<String> keys, String... args) {
        Long result;
        String[] arguments = Arrays.copyOf(args,args.length+1); arguments[args.length]=UUID.randomUUID().toString();
        try { result = redis.execute(script,keys,(Object[])arguments); }
        catch (DataAccessException unavailable) { throw new ApiProblem(503,"购物车存储暂不可用，请重试；原购物车不会被清空"); }
        if (result == null) throw new ApiProblem(503,"购物车操作结果未知，请刷新后重试");
        if (result == -1) throw new ApiProblem(409,"同一 SKU 合并后的数量不能超过 999");
        if (result == -2) throw new ApiProblem(409,"购物车最多保存 100 种 SKU，请先移除部分商品");
        if (result == -3) throw new ApiProblem(409,"同一合并编号不能对应不同的访客购物车");
        if (result == -4) throw new ApiProblem(409,"此会员的合并记录已达到上限，请联系管理员；本地购物车仍保留");
        if (result == -5) throw new ApiProblem(404,"购物车中没有此 SKU，请刷新");
        if (result == -7) throw new ApiProblem(409,"同一加购请求不能修改 SKU 或增量数量，请查询原请求");
        if (result == -8) throw new ApiProblem(409,"此会员的加购回执已达到10000条上限，新加购未执行；原请求仍可查询和重放");
        if (result < 0) throw new ApiProblem(400,"购物车操作不正确");
        return result;
    }
    public void add(long memberId, CartInput item) {
        validate(item,true);
        String requestId=item.getRequestId(),digest=null;
        if(requestId!=null) {
            validateAdditionId(requestId); digest=additionDigest(item);
            Map<String,Object> receipt=additionReceipt(memberId,requestId);
            if(receipt!=null) { replayAddition(receipt,digest); return; }
        }
        CartView fresh = enrich(Collections.singletonList(item));
        reject(fresh.getItems().get(0));
        if(requestId==null) execute(mutate,Collections.singletonList(key(memberId)),"add",item.getSkuId().toString(),item.getCount().toString());
        else execute(addition,Arrays.asList(key(memberId),additionKey(memberId)),requestId,digest,item.getSkuId().toString(),item.getCount().toString());
    }
    private String additionKey(long memberId) { key(memberId); return "gulimall:cart:{"+memberId+"}:adds"; }
    private static void validateAdditionId(String value) {
        if(value==null || !value.matches("[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}")) throw new ApiProblem(400,"加购请求标识须为小写UUID");
    }
    static String additionDigest(CartInput item) { return sha256(JSON.toJSONString(Arrays.asList(item.getSkuId().toString(),item.getCount()))); }
    private static String sha256(String payload) {
        try {
            byte[] hash=MessageDigest.getInstance("SHA-256").digest(payload.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex=new StringBuilder(); for(byte value:hash) hex.append(String.format("%02x",value&255)); return hex.toString();
        } catch(java.security.NoSuchAlgorithmException impossible) { throw new IllegalStateException(impossible); }
    }
    private Map<String,Object> additionReceipt(long memberId,String requestId) {
        Object raw;
        try { raw=redis.opsForHash().get(additionKey(memberId),requestId); }
        catch(DataAccessException unavailable) { throw new ApiProblem(503,"加购回执暂不可用，请保留原请求并重试查询"); }
        if(raw==null) return null;
        try {
            Map<String,Object> value=JSON.parseObject(raw.toString());
            if(value.size()!=3 || !(value.get("hash") instanceof String) || !((String)value.get("hash")).matches("[a-f0-9]{64}")
                    || !(value.get("skuId") instanceof String) || !((String)value.get("skuId")).matches("[1-9][0-9]*") || Long.parseLong((String)value.get("skuId"))<1
                    || !(value.get("count") instanceof Integer) || (Integer)value.get("count")<1 || (Integer)value.get("count")>999) throw new IllegalStateException("Invalid addition receipt");
            return value;
        } catch(RuntimeException malformed) { throw new ApiProblem(503,"加购回执无法读取，请保留原请求并联系管理员，不能另建请求替代"); }
    }
    private void replayAddition(Map<String,Object> receipt,String digest) {
        if(!digest.equals(receipt.get("hash"))) throw new ApiProblem(409,"同一加购请求不能修改 SKU 或增量数量，请查询原请求");
    }
    public Map<String,Object> addition(long memberId,String requestId) {
        validateAdditionId(requestId); Map<String,Object> receipt=additionReceipt(memberId,requestId),result=new LinkedHashMap<>();
        result.put("executed",receipt!=null);
        if(receipt!=null) { result.put("skuId",Long.valueOf((String)receipt.get("skuId"))); result.put("count",receipt.get("count")); }
        return result;
    }
    public void count(long memberId, CartInput item) { validate(item,true); execute(mutate,Collections.singletonList(key(memberId)),"count",item.getSkuId().toString(),item.getCount().toString()); }
    public void check(long memberId, CartInput item) { validate(item,false); if (item.getChecked() == null) throw new ApiProblem(400,"勾选状态不能为空"); execute(mutate,Collections.singletonList(key(memberId)),"check",item.getSkuId().toString(),item.getChecked().toString()); }
    public void remove(long memberId, Long skuId) { CartInput input = new CartInput(); input.setSkuId(skuId); validate(input,false); execute(mutate,Collections.singletonList(key(memberId)),"remove",skuId.toString(),""); }
    public void clear(long memberId) { execute(mutate,Collections.singletonList(key(memberId)),"clear","",""); }

    public static List<CartInput> normalize(CartMerge request) {
        if (request == null || request.getMergeId() == null || !request.getMergeId().matches("[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}")
                || request.getItems() == null || request.getItems().isEmpty() || request.getItems().size() > 100) throw new ApiProblem(400,"合并请求须包含 UUID 编号及 1–100 项商品");
        Map<Long,CartInput> result = new TreeMap<>();
        for (CartInput value : request.getItems()) {
            validate(value,true);
            CartInput item = result.get(value.getSkuId());
            if (item == null) { item = new CartInput(); item.setSkuId(value.getSkuId()); item.setCount(0); item.setChecked(false); result.put(item.getSkuId(),item); }
            item.setCount(item.getCount()+value.getCount()); item.setChecked(item.getChecked() || !Boolean.FALSE.equals(value.getChecked()));
            if (item.getCount() > 999) throw new ApiProblem(400,"访客购物车同一 SKU 数量不能超过 999");
        }
        return new ArrayList<>(result.values());
    }
    public boolean merge(long memberId, CartMerge request) {
        List<Map<String,Object>> lines = normalize(request).stream().map(item -> {
            Map<String,Object> value = new LinkedHashMap<>(); value.put("skuId",item.getSkuId().toString()); value.put("count",item.getCount()); value.put("checked",item.getChecked()); return value;
        }).collect(Collectors.toList());
        String payload = JSON.toJSONString(lines), digest=sha256(payload);
        // Receipts outlive cart clearing, so a delayed retry never restores intentionally removed items.
        return execute(merge,Arrays.asList(key(memberId),"gulimall:cart:{"+memberId+"}:merges"),request.getMergeId().toLowerCase(Locale.ROOT),digest,payload) == 0;
    }
    public CartView view(long memberId, boolean selected) {
        Map<Object,Object> values;
        try { values = redis.opsForHash().entries(key(memberId)); }
        catch (DataAccessException unavailable) { throw new ApiProblem(503,"购物车存储暂不可用，请稍后重试"); }
        List<CartInput> items = new ArrayList<>();
        for (Map.Entry<Object,Object> entry : values.entrySet()) {
            CartInput item = JSON.parseObject(entry.getValue().toString(),CartInput.class); item.setSkuId(Long.valueOf(entry.getKey().toString()));
            if(item.getRevision()==null) item.setRevision(entry.getValue().toString());
            if (!selected || Boolean.TRUE.equals(item.getChecked())) items.add(item);
        }
        items.sort(Comparator.comparing(CartInput::getSkuId));
        CartView view = enrich(items);
        if (selected) {
            if (view.getItems().isEmpty()) throw new ApiProblem(409,"请至少勾选一件商品");
            view.getItems().forEach(this::reject);
        }
        return view;
    }
    private void reject(CartLine item) {
        if (!item.isPurchasable()) throw new ApiProblem("SERVICE_UNAVAILABLE".equals(item.getStatus()) || "STOCK_UNKNOWN".equals(item.getStatus()) ? 503 : 409, item.getSkuName()+"："+item.getMessage());
    }
    public CartView enrich(List<CartInput> stored) {
        Map<Long,CartProductTo> current = new HashMap<>(); boolean failed = false;
        if (!stored.isEmpty()) try {
            R response = products.products(stored.stream().map(CartInput::getSkuId).collect(Collectors.toList()));
            if (response.getCode() != 0) throw new IllegalStateException("Product lookup failed");
            List<CartProductTo> list = response.getData("data",new TypeReference<List<CartProductTo>>(){});
            if (list == null) throw new IllegalStateException("Product lookup incomplete");
            for (CartProductTo product : list) current.put(product.getSkuId(),product);
        } catch (Exception unavailable) { failed=true; }
        CartView view = new CartView(); List<CartLine> lines = new ArrayList<>(); view.setItems(lines);
        BigDecimal total = BigDecimal.ZERO; boolean ready=true;
        for (CartInput saved : stored) {
            CartProductTo fresh = current.get(saved.getSkuId()); CartLine line = new CartLine();
            if (fresh != null) BeanUtils.copyProperties(fresh,line);
            else { line.setSkuId(saved.getSkuId()); line.setSkuName("SKU #"+saved.getSkuId()); }
            line.setCount(saved.getCount()); line.setChecked(!Boolean.FALSE.equals(saved.getChecked()));
            line.setRevision(saved.getRevision());
            String status, message;
            if (failed) { status="SERVICE_UNAVAILABLE"; message="商品服务暂不可用，无法确认价格与可售性"; }
            else if (fresh == null) { status="DELETED"; message="商品已删除或不存在"; }
            else if (!fresh.isOnSale()) { status="OFF_SHELF"; message="商品已下架"; }
            else if (fresh.getPrice() == null || fresh.getPrice().signum() < 0) { line.setPrice(null); status="PRICE_UNAVAILABLE"; message="当前价格不可用"; }
            else if (fresh.getHasStock() == null) { status="STOCK_UNKNOWN"; message="库存未知，请稍后刷新"; }
            else if (!fresh.getHasStock()) { status="OUT_OF_STOCK"; message="商品暂时缺货"; }
            else { status="AVAILABLE"; message="可购买"; }
            line.setStatus(status); line.setMessage(message); lines.add(line);
            view.setTotalCount(view.getTotalCount()+line.getCount());
            if (line.isChecked()) { view.setCheckedCount(view.getCheckedCount()+line.getCount()); ready &= line.isPurchasable(); if (line.isPurchasable()) total=total.add(line.getPrice().multiply(BigDecimal.valueOf(line.getCount()))); }
        }
        view.setReadyToCheckout(ready && view.getCheckedCount()>0); view.setTotalAmount(ready ? total : null); return view;
    }
    public void ordered(long memberId, com.atguigu.common.to.StockLockTo request) {
        if(request==null || request.getOrderSn()==null || !request.getOrderSn().matches("[a-f0-9]{32}") || request.getItems()==null || request.getItems().isEmpty() || request.getItems().size()>100) throw new ApiProblem(400,"订单购物车快照不正确");
        List<Map<String,Object>> lines=new ArrayList<>();
        for(com.atguigu.common.to.OrderLineTo item:request.getItems()) {
            if(item.getSkuId()==null || item.getSkuId()<1 || item.getRevision()==null) throw new ApiProblem(400,"购物车版本不正确");
            Map<String,Object> line=new LinkedHashMap<>(); line.put("skuId",item.getSkuId().toString()); line.put("revision",item.getRevision()); lines.add(line);
        }
        execute(ordered,Arrays.asList(key(memberId),"gulimall:cart:{"+memberId+"}:orders"),request.getOrderSn(),JSON.toJSONString(lines));
    }
}
