package com.atguigu.gulimall.order.service;

import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.TypeReference;
import com.atguigu.common.security.*;
import com.atguigu.common.to.*;
import com.atguigu.common.utils.R;
import com.atguigu.gulimall.order.dao.*;
import com.atguigu.gulimall.order.entity.*;
import com.atguigu.gulimall.order.feign.*;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import feign.FeignException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.math.BigDecimal;
import java.util.*;
import java.util.function.Supplier;
import java.util.stream.Collectors;

@Service
public class OrderCreationService {
    public static final int CREATING=6, CLOSING=7, PENDING=0, CLOSED=4;
    @Autowired private JdbcTemplate db;
    @Autowired private OrderDao orders;
    @Autowired private OrderItemDao items;
    @Autowired private PlatformTransactionManager transactions;
    @Autowired private CartFeignService cart;
    @Autowired private MemberFeignService members;
    @Autowired private ProductFeignService products;
    @Autowired private StockFeignService stock;

    private R rpc(Supplier<R> action) {
        try {
            R result=action.get();
            if(result==null || result.getCode()!=0) throw new ApiProblem(503,"业务服务结果不完整，请重试");
            return result;
        } catch(FeignException e) {
            int status=Arrays.asList(400,403,404,409).contains(e.status())?e.status():503;
            String message=status==503?"依赖服务暂不可用，已创建订单会自动恢复，请勿重新创建确认单":"商品、库存或地址校验失败，请刷新确认";
            throw new ApiProblem(status,message);
        }
    }
    public static BigDecimal total(List<OrderLineTo> lines) {
        if(lines==null || lines.isEmpty() || lines.size()>100) throw new ApiProblem(409,"请至少勾选一件商品");
        Set<Long> seen=new HashSet<>(); BigDecimal total=BigDecimal.ZERO;
        for(OrderLineTo line:lines) {
            if(line==null || line.getSkuId()==null || line.getSkuId()<1 || !seen.add(line.getSkuId()) || line.getCount()==null || line.getCount()<1 || line.getCount()>999 || line.getPrice()==null || line.getPrice().signum()<0 || line.getPrice().scale()>2) throw new ApiProblem(400,"商品数量或金额不正确");
            total=total.add(line.getPrice().multiply(BigDecimal.valueOf(line.getCount())));
        }
        if(total.compareTo(new BigDecimal("999999999999999999.99"))>0) throw new ApiProblem(400,"订单金额超过上限");
        return total.setScale(2);
    }
    public Map<String,Object> confirm(long memberId) {
        List<OrderLineTo> lines=rpc(()->cart.selected(memberId)).getData("data",new TypeReference<List<OrderLineTo>>(){});
        BigDecimal total=total(lines);
        List<OrderAddressTo> addresses=rpc(()->members.addresses(memberId)).getData("data",new TypeReference<List<OrderAddressTo>>(){});
        if(addresses==null) throw new ApiProblem(503,"地址服务结果不完整");
        String token=UUID.randomUUID().toString();
        db.update("INSERT INTO oms_order_submit(token,member_id,items_json,expires_at) VALUES(?,?,?,DATE_ADD(NOW(),INTERVAL 15 MINUTE))",token,memberId,JSON.toJSONString(lines));
        Map<String,Object> result=new LinkedHashMap<>(); result.put("token",token); result.put("items",lines); result.put("addresses",addresses); result.put("totalAmount",total); result.put("freightAmount",BigDecimal.ZERO); result.put("expiresAt",request(token,memberId).get("expires_at")); return result;
    }
    private Map<String,Object> request(String token,long memberId) {
        if(token==null || !token.matches("[a-f0-9-]{36}")) throw new ApiProblem(400,"提交令牌不正确");
        List<Map<String,Object>> found=db.queryForList("SELECT *,expires_at>NOW() AS valid FROM oms_order_submit WHERE token=?",token);
        if(found.isEmpty()) throw new ApiProblem(404,"确认单不存在，请重新确认");
        Map<String,Object> request=found.get(0);
        if(((Number)request.get("member_id")).longValue()!=memberId) throw new ApiProblem(403,"不能使用其他会员的确认单");
        return request;
    }
    private boolean valid(Object value) { return Boolean.TRUE.equals(value) || value instanceof Number && ((Number)value).intValue()==1; }
    public Map<String,Object> submission(String token,long memberId) {
        Map<String,Object> saved=request(token,memberId);
        if(saved.get("order_sn")==null) {
            List<OrderLineTo> lines=JSON.parseArray((String)saved.get("items_json"),OrderLineTo.class);
            Map<String,Object> confirmation=new LinkedHashMap<>(); confirmation.put("token",token); confirmation.put("items",lines); confirmation.put("totalAmount",total(lines)); confirmation.put("expiresAt",saved.get("expires_at"));
            confirmation.put("addresses",rpc(()->members.addresses(memberId)).get("data"));
            Map<String,Object> result=new LinkedHashMap<>(); result.put("order",null); result.put("confirmation",confirmation); return result;
        }
        return detail((String)saved.get("order_sn"),memberId);
    }
    public Map<String,Object> retire(String token,long memberId) {
        request(token,memberId);
        String sn=new TransactionTemplate(transactions).execute(tx->{
            Map<String,Object> saved=db.queryForMap("SELECT order_sn FROM oms_order_submit WHERE token=? FOR UPDATE",token);
            if(saved.get("order_sn")==null) db.update("UPDATE oms_order_submit SET expires_at=NOW() WHERE token=?",token);
            return (String)saved.get("order_sn");
        });
        if(sn!=null) return detail(sn,memberId);
        Map<String,Object> result=new LinkedHashMap<>(); result.put("order",null); return result;
    }
    public Map<String,Object> submit(String token,Long addressId,SessionUser user) {
        Map<String,Object> saved=request(token,user.getId());
        if(addressId==null || addressId<1) throw new ApiProblem(400,"请选择收货地址");
        if(saved.get("order_sn")!=null) {
            if(!addressId.equals(((Number)saved.get("address_id")).longValue())) throw new ApiProblem(409,"该令牌已用于其他地址，不得更改");
            advance((String)saved.get("order_sn")); return detail((String)saved.get("order_sn"),user.getId());
        }
        if(!valid(saved.get("valid"))) throw new ApiProblem(409,"提交令牌已过期，请重新确认");
        OrderAddressTo address=rpc(()->members.address(user.getId(),addressId)).getData("data",new TypeReference<OrderAddressTo>(){});
        if(address==null || !user.getId().equals(address.getMemberId())) throw new ApiProblem(403,"地址不属于当前会员");
        List<OrderLineTo> lines=JSON.parseArray((String)saved.get("items_json"),OrderLineTo.class);
        List<CartProductTo> fresh=rpc(()->products.products(lines.stream().map(OrderLineTo::getSkuId).collect(Collectors.toList()),false)).getData("data",new TypeReference<List<CartProductTo>>(){});
        if(fresh==null) throw new ApiProblem(503,"商品资料不完整");
        Map<Long,CartProductTo> byId=fresh.stream().collect(Collectors.toMap(CartProductTo::getSkuId,p->p));
        for(OrderLineTo line:lines) {
            CartProductTo product=byId.get(line.getSkuId());
            if(product==null || !product.isOnSale() || product.getPrice()==null || product.getPrice().compareTo(line.getPrice())!=0) throw new ApiProblem(409,"商品下架、删除或价格已变化，请重新确认");
            org.springframework.beans.BeanUtils.copyProperties(product,line);
        }
        BigDecimal amount=total(lines);
        String sn=new TransactionTemplate(transactions).execute(tx->{
            Map<String,Object> locked=db.queryForMap("SELECT *,expires_at>NOW() AS valid FROM oms_order_submit WHERE token=? FOR UPDATE",token);
            if(locked.get("order_sn")!=null) {
                if(!addressId.equals(((Number)locked.get("address_id")).longValue())) throw new ApiProblem(409,"该令牌已用于其他地址");
                return (String)locked.get("order_sn");
            }
            if(!valid(locked.get("valid"))) throw new ApiProblem(409,"提交令牌已过期");
            OrderEntity order=new OrderEntity(); order.setOrderSn(UUID.randomUUID().toString().replace("-","")); order.setMemberId(user.getId()); order.setMemberUsername(user.getUsername()); order.setStatus(CREATING); order.setCartCleaned(0);
            order.setCreateTime(new Date()); order.setModifyTime(new Date()); order.setTotalAmount(amount); order.setPayAmount(amount); order.setFreightAmount(BigDecimal.ZERO); order.setCouponAmount(BigDecimal.ZERO); order.setPromotionAmount(BigDecimal.ZERO); order.setIntegrationAmount(BigDecimal.ZERO); order.setDiscountAmount(BigDecimal.ZERO); order.setUseIntegration(0); order.setSourceType(0); order.setDeleteStatus(0); order.setConfirmStatus(0);
            order.setReceiverName(address.getName()); order.setReceiverPhone(address.getPhone()); order.setReceiverPostCode(address.getPostCode()); order.setReceiverProvince(address.getProvince()); order.setReceiverCity(address.getCity()); order.setReceiverRegion(address.getRegion()); order.setReceiverDetailAddress(address.getDetailAddress());
            orders.insert(order);
            for(OrderLineTo line:lines) {
                OrderItemEntity item=new OrderItemEntity(); item.setOrderId(order.getId()); item.setOrderSn(order.getOrderSn()); item.setSkuId(line.getSkuId()); item.setSpuId(line.getSpuId()); item.setCategoryId(line.getCatalogId()); item.setSkuName(line.getSkuName()); item.setSkuPic(line.getSkuDefaultImg()); item.setSkuPrice(line.getPrice()); item.setSkuQuantity(line.getCount()); item.setSkuAttrsVals(line.getSkuAttrsVals()); item.setRealAmount(line.getPrice().multiply(BigDecimal.valueOf(line.getCount()))); item.setCartRevision(line.getRevision()); items.insert(item);
            }
            db.update("UPDATE oms_order SET creation_deadline=DATE_ADD(NOW(),INTERVAL 5 MINUTE),recovery_after=NOW() WHERE id=?",order.getId());
            db.update("UPDATE oms_order_submit SET order_sn=?,address_id=? WHERE token=?",order.getOrderSn(),addressId,token);
            history(order.getId(),CREATING,"创建请求已持久化，等待库存结果"); return order.getOrderSn();
        });
        advance(sn); return detail(sn,user.getId());
    }
    public Map<String,Object> detail(String sn,long memberId) {
        OrderEntity order=orders.selectOne(new QueryWrapper<OrderEntity>().eq("order_sn",sn));
        if(order==null) throw new ApiProblem(404,"订单不存在");
        if(!Long.valueOf(memberId).equals(order.getMemberId())) throw new ApiProblem(403,"不能访问其他会员的订单");
        Map<String,Object> result=new LinkedHashMap<>(); result.put("order",order); result.put("items",items.selectList(new QueryWrapper<OrderItemEntity>().eq("order_sn",sn).orderByAsc("sku_id"))); return result;
    }
    private void history(long id,int state,String note) { db.update("INSERT INTO oms_order_operate_history(order_id,operate_man,create_time,order_status,note) VALUES(?,'system',NOW(),?,?)",id,state,note); }
    private void transition(String sn,int from,int to,String reason) {
        new TransactionTemplate(transactions).execute(tx->{
            int changed=db.update("UPDATE oms_order SET status=?,failure_reason=?,modify_time=NOW(),recovery_after=NOW(),payment_deadline=IF(?=0,DATE_ADD(NOW(),INTERVAL 30 MINUTE),payment_deadline) WHERE order_sn=? AND status=?",to,reason,to,sn,from);
            if(changed==1) history(orders.selectOne(new QueryWrapper<OrderEntity>().eq("order_sn",sn)).getId(),to,reason==null?"库存锁定已确认，等待付款":reason);
            return null;
        });
    }
    private StockLockTo lockRequest(OrderEntity order) {
        StockLockTo request=new StockLockTo(); request.setOrderSn(order.getOrderSn());
        List<OrderLineTo> lines=new ArrayList<>();
        for(OrderItemEntity item:items.selectList(new QueryWrapper<OrderItemEntity>().eq("order_sn",order.getOrderSn()).orderByAsc("sku_id"))) { OrderLineTo line=new OrderLineTo(); line.setSkuId(item.getSkuId()); line.setCount(item.getSkuQuantity()); line.setRevision(item.getCartRevision()); lines.add(line); }
        request.setItems(lines); return request;
    }
    public void advance(String sn) {
        OrderEntity order=orders.selectOne(new QueryWrapper<OrderEntity>().eq("order_sn",sn)); if(order==null) return;
        db.update("UPDATE oms_order SET recovery_after=DATE_ADD(NOW(),INTERVAL 10 SECOND) WHERE order_sn=?",sn);
        try {
            if(order.getStatus()==CREATING) {
                boolean expired=db.queryForObject("SELECT creation_deadline<=NOW() FROM oms_order WHERE order_sn=?",Boolean.class,sn);
                if(expired) transition(sn,CREATING,CLOSING,"创建超时，正在确认释放库存");
                else {
                    try {
                        String state=(String)((Map<?,?>)rpc(()->stock.status(sn)).get("data")).get("state");
                        OrderEntity creating=order;
                        if("ABSENT".equals(state)) state=(String)((Map<?,?>)rpc(()->stock.lock(lockRequest(creating))).get("data")).get("state");
                        if("LOCKED".equals(state)) transition(sn,CREATING,PENDING,null);
                        else if("RELEASED".equals(state)) transition(sn,CREATING,CLOSING,"库存工作单已释放");
                    } catch(ApiProblem failure) { if(failure.getStatus()==409) transition(sn,CREATING,CLOSING,"库存不足，正在确认释放库存"); else throw failure; }
                }
            }
            order=orders.selectOne(new QueryWrapper<OrderEntity>().eq("order_sn",sn));
            if(order.getStatus()==CLOSING) {
                String state=(String)((Map<?,?>)rpc(()->stock.release(sn)).get("data")).get("state");
                if("RELEASED".equals(state)) transition(sn,CLOSING,CLOSED,"创建失败，库存释放已确认");
            }
            order=orders.selectOne(new QueryWrapper<OrderEntity>().eq("order_sn",sn));
            if(order.getStatus()==PENDING && Integer.valueOf(0).equals(order.getCartCleaned())) {
                OrderEntity pending=order; rpc(()->cart.ordered(pending.getMemberId(),lockRequest(pending)));
                db.update("UPDATE oms_order SET cart_cleaned=1 WHERE order_sn=? AND status=0",sn);
            }
        } catch(Exception unavailable) {
            // The persisted state remains authoritative; a timeout never means that locking failed.
        }
    }
    @Scheduled(fixedDelay=10000,initialDelay=10000) public void recover() {
        try {
            for(String sn:db.queryForList("SELECT order_sn FROM oms_order WHERE (status IN(6,7) OR (status=0 AND cart_cleaned=0)) AND recovery_after<=NOW() ORDER BY recovery_after,id LIMIT 20",String.class)) advance(sn);
        } catch(Exception unavailable) { /* Retry after the database or a dependent service recovers. */ }
    }
}
