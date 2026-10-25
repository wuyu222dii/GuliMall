package com.atguigu.gulimall.order.service;
import com.alibaba.fastjson.JSON;
import com.atguigu.common.constant.TradeMessages;
import com.atguigu.common.security.ApiProblem;
import com.atguigu.gulimall.order.config.AlipayTemplate;
import com.atguigu.gulimall.order.dao.OrderDao;
import com.atguigu.gulimall.order.entity.OrderEntity;
import com.atguigu.gulimall.order.feign.StockFeignService;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.math.BigDecimal;
import java.util.*;

@Service
public class PaymentSettlementService {
    @Autowired private JdbcTemplate db;
    @Autowired private OrderDao orders;
    @Autowired private AlipayTemplate alipay;
    @Autowired private TradeEventService events;
    @Autowired private StockFeignService stock;
    private final TransactionTemplate transaction;
    @Autowired public PaymentSettlementService(PlatformTransactionManager manager) { transaction=new TransactionTemplate(manager); }
    public OrderEntity owned(String sn,long memberId) {
        OrderEntity order=orders.selectOne(new QueryWrapper<OrderEntity>().eq("order_sn",sn));
        if(order==null) throw new ApiProblem(404,"订单不存在");
        if(!Long.valueOf(memberId).equals(order.getMemberId())) throw new ApiProblem(403,"不能操作其他会员的订单"); return order;
    }
    public Map<String,Object> status(String sn,long memberId) {
        Map<String,Object> result=new LinkedHashMap<>(); result.put("order",owned(sn,memberId)); result.put("mode",alipay.localTest()?"LOCAL_TEST":"ALIPAY_SANDBOX"); result.put("configured",alipay.ready()); return result;
    }
    public Map<String,Object> form(String sn,long memberId) {
        owned(sn,memberId); alipay.configured();
        return transaction.execute(tx->{
            Map<String,Object> row=db.queryForMap("SELECT *,payment_deadline>NOW() AS payable FROM oms_order WHERE order_sn=? FOR UPDATE",sn);
            Object payable=row.get("payable");
            if(((Number)row.get("status")).intValue()!=0 || !(Boolean.TRUE.equals(payable) || payable instanceof Number && ((Number)payable).intValue()==1)) throw new ApiProblem(409,"订单不在可支付期限内，请查询订单状态");
            List<String> names=db.queryForList("SELECT sku_name FROM oms_order_item WHERE order_sn=? ORDER BY id LIMIT 1",String.class,sn);
            String html=alipay.form(sn,(BigDecimal)row.get("pay_amount"),names.isEmpty()?"Gulimall order":names.get(0),(Date)row.get("payment_deadline"));
            db.update("UPDATE oms_order SET payment_started=1,recovery_after=NOW() WHERE order_sn=?",sn);
            Map<String,Object> result=new LinkedHashMap<>(); result.put("html",html); result.put("mode",alipay.localTest()?"LOCAL_TEST":"ALIPAY_SANDBOX"); return result;
        });
    }
    public void notify(Map<String,String> params) {
        alipay.verify(params);
        String sn=params.get("out_trade_no"), trade=params.get("trade_no"), state=params.get("trade_status");
        if(sn==null || !sn.matches("[a-f0-9]{32}") || trade==null || !trade.matches("[A-Za-z0-9_-]{1,128}")) throw new ApiProblem(400,"支付订单号不正确");
        BigDecimal amount=AlipayTemplate.amount(params.get("total_amount"));
        if(!Arrays.asList("TRADE_SUCCESS","TRADE_FINISHED","WAIT_BUYER_PAY","TRADE_CLOSED").contains(state)) throw new ApiProblem(400,"交易状态不正确");
        if("TRADE_SUCCESS".equals(state) || "TRADE_FINISHED".equals(state)) paid(sn,trade,amount,AlipayTemplate.paymentTime(params.get("gmt_payment")),state);
        else {
            OrderEntity order=orders.selectOne(new QueryWrapper<OrderEntity>().eq("order_sn",sn));
            if(order==null || order.getPayAmount().compareTo(amount)!=0) throw new ApiProblem(409,"通知与订单不匹配");
        }
    }
    private void history(long id,int state,String note) { db.update("INSERT INTO oms_order_operate_history(order_id,operate_man,create_time,order_status,note) VALUES(?,'alipay',NOW(),?,?)",id,state,note); }
    public void paid(String sn,String trade,BigDecimal amount,Date paidAt,String providerState) {
        if(trade==null || !trade.matches("[A-Za-z0-9_-]{1,128}")) throw new ApiProblem(503,"支付宝交易号不正确");
        transaction.execute(tx->{
            Map<String,Object> order=db.queryForMap("SELECT * FROM oms_order WHERE order_sn=? FOR UPDATE",sn);
            if(((BigDecimal)order.get("pay_amount")).compareTo(amount)!=0) throw new ApiProblem(409,"支付金额与订单不匹配");
            List<Map<String,Object>> existing=db.queryForList("SELECT order_sn,total_amount FROM oms_payment_info WHERE alipay_trade_no=?",trade);
            if(!existing.isEmpty()) {
                if(!sn.equals(existing.get(0).get("order_sn")) || amount.compareTo((BigDecimal)existing.get(0).get("total_amount"))!=0) throw new ApiProblem(409,"支付流水冲突");
                return null;
            }
            int status=((Number)order.get("status")).intValue();
            boolean timely=paidAt!=null && order.get("payment_deadline")!=null && !paidAt.after((Date)order.get("payment_deadline"));
            boolean normal=Arrays.asList(0,8).contains(status) && timely && order.get("payment_trade_no")==null;
            String problem=normal?null:"异常或迟到付款，禁止发货，需人工核对及退款处理";
            Map<String,Object> receipt=new LinkedHashMap<>(); receipt.put("app_id",alipay.getApp_id()); receipt.put("seller_id",alipay.getSeller_id()); receipt.put("order_sn",sn); receipt.put("trade_no",trade); receipt.put("total_amount",amount); receipt.put("trade_status",providerState); receipt.put("paid_at",paidAt==null?null:AlipayTemplate.timestamp(paidAt));
            db.update("INSERT INTO oms_payment_info(order_sn,order_id,alipay_trade_no,total_amount,payment_status,create_time,confirm_time,callback_time,callback_content,exception_reason) VALUES(?,?,?,?,?,NOW(),?,NOW(),?,?)",sn,order.get("id"),trade,amount,providerState,paidAt,JSON.toJSONString(receipt),problem);
            db.update("UPDATE oms_order SET status=?,payment_trade_no=COALESCE(payment_trade_no,?),pay_type=1,payment_time=COALESCE(payment_time,?),modify_time=NOW(),failure_reason=?,recovery_after=NOW() WHERE order_sn=?",normal?1:9,trade,paidAt,problem,sn);
            history(((Number)order.get("id")).longValue(),normal?1:9,normal?"支付宝付款已确认，等待库存扣减":problem);
            if(normal) events.enqueue(sn,TradeMessages.DEDUCT);
            return null;
        });
    }
    private OrderEntity current(String sn) { return orders.selectOne(new QueryWrapper<OrderEntity>().eq("order_sn",sn)); }
    private void beginClose(String sn) {
        transaction.execute(tx->{
            Map<String,Object> row=db.queryForMap("SELECT id,status,payment_deadline<=NOW() AS expired FROM oms_order WHERE order_sn=? FOR UPDATE",sn);
            Object expired=row.get("expired");
            if(((Number)row.get("status")).intValue()==0 && (Boolean.TRUE.equals(expired) || expired instanceof Number && ((Number)expired).intValue()==1)) {
                db.update("UPDATE oms_order SET status=8,failure_reason='付款期限已到，正在确认支付宝结果',modify_time=NOW() WHERE order_sn=?",sn);
                history(((Number)row.get("id")).longValue(),8,"超时关单意图已持久化，库存保持锁定");
            } return null;
        });
    }
    private void closed(String sn) {
        transaction.execute(tx->{
            Map<String,Object> row=db.queryForMap("SELECT id,status FROM oms_order WHERE order_sn=? FOR UPDATE",sn);
            if(Arrays.asList(0,8).contains(((Number)row.get("status")).intValue())) {
                db.update("UPDATE oms_order SET status=4,failure_reason='未付款订单关闭已确认，等待库存释放',modify_time=NOW(),recovery_after=NOW() WHERE order_sn=?",sn);
                history(((Number)row.get("id")).longValue(),4,"支付宝未付款关闭已确认，提交库存释放事件"); events.enqueue(sn,TradeMessages.RELEASE);
            } return null;
        });
    }
    public void reconcile(String sn) {
        OrderEntity order=current(sn); if(order==null) return;
        db.update("UPDATE oms_order SET recovery_after=DATE_ADD(NOW(),INTERVAL 15 SECOND) WHERE order_sn=?",sn);
        try {
            if(order.getStatus()==0 || order.getStatus()==8) {
                beginClose(sn); order=current(sn);
                if(order.getStatus()!=0 && order.getStatus()!=8) return;
                AlipayTemplate.Trade trade=alipay.query(sn);
                if(!"ABSENT".equals(trade.getState()) && (trade.getAmount()==null || trade.getAmount().compareTo(order.getPayAmount())!=0)) throw new ApiProblem(503,"支付宝查询金额不匹配，保留库存");
                if(Arrays.asList("TRADE_SUCCESS","TRADE_FINISHED").contains(trade.getState())) paid(sn,trade.getTradeNo(),trade.getAmount(),trade.getPaidAt(),trade.getState());
                else if("TRADE_CLOSED".equals(trade.getState())) closed(sn);
                else if(order.getStatus()==8) {
                    if("ABSENT".equals(trade.getState()) && Integer.valueOf(0).equals(order.getPaymentStarted())) closed(sn);
                    else if("WAIT_BUYER_PAY".equals(trade.getState()) && alipay.close(sn)) closed(sn);
                    else db.update("UPDATE oms_order SET failure_reason='支付或关单结果未确认，保留库存并继续重试' WHERE order_sn=? AND status=8",sn);
                }
            }
            order=current(sn);
            if((order.getStatus()==1 || order.getStatus()==4) && Integer.valueOf(0).equals(order.getInventoryStatus())) {
                String type=order.getStatus()==1?TradeMessages.DEDUCT:TradeMessages.RELEASE;
                transaction.execute(tx->{ events.enqueue(sn,type); return null; });
                Map<?,?> response=(Map<?,?>)stock.status(sn).get("data"); String state=(String)response.get("state");
                if((order.getStatus()==1 && "DEDUCTED".equals(state)) || (order.getStatus()==4 && "RELEASED".equals(state))) {
                    Long event=db.queryForObject("SELECT id FROM oms_trade_event WHERE order_sn=? AND event_type=?",Long.class,sn,type); events.completed(event,state);
                } else if(order.getStatus()==1 && "RELEASED".equals(state)) db.update("UPDATE oms_order SET status=9,failure_reason='已付款库存已释放，禁止发货，需人工处理' WHERE order_sn=? AND status=1",sn);
            }
        } catch(Exception unknown) {
            db.update("UPDATE oms_order SET failure_reason='支付或库存结果未确认，保留当前记录并重试' WHERE order_sn=? AND status=8",sn);
        }
    }
    @Scheduled(fixedDelay=5000,initialDelay=5000) public void compensate() {
        try {
            for(String sn:db.queryForList("SELECT order_sn FROM oms_order WHERE recovery_after<=NOW() AND ((status=0 AND (payment_started=1 OR payment_deadline<=NOW())) OR status=8 OR (status IN(1,4) AND inventory_status=0)) ORDER BY recovery_after,id LIMIT 10",String.class)) reconcile(sn);
        } catch(Exception unavailable) { /* Durable orders and events are scanned after restart. */ }
    }
}
