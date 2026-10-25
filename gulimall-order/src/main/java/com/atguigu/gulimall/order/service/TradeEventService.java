package com.atguigu.gulimall.order.service;
import com.alibaba.fastjson.JSON;
import com.atguigu.common.constant.TradeMessages;
import com.atguigu.common.security.ApiProblem;
import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.connection.CorrelationData;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import javax.annotation.PostConstruct;
import java.util.*;
@Service
public class TradeEventService {
    @Autowired private JdbcTemplate db;
    @Autowired private RabbitTemplate rabbit;
    @PostConstruct public void mandatory() { rabbit.setMandatory(true); }
    public void enqueue(String sn,String type) {
        if(!Arrays.asList(TradeMessages.DEDUCT,TradeMessages.RELEASE,TradeMessages.TIMER).contains(type)) throw new IllegalArgumentException("Unknown trade event");
        db.update("INSERT INTO oms_trade_event(order_sn,event_type,created_at,next_attempt) VALUES(?,?,NOW(),NOW()) ON DUPLICATE KEY UPDATE id=id",sn,type);
    }
    public Map<String,Object> descriptor(long id) {
        List<Map<String,Object>> result=db.queryForList("SELECT id,order_sn,event_type,consumed_at FROM oms_trade_event WHERE id=?",id);
        if(result.isEmpty()) throw new ApiProblem(404,"事件不存在"); return result.get(0);
    }
    @Transactional public void completed(long id,String state) {
        Map<String,Object> description=descriptor(id);
        Map<String,Object> order=db.queryForMap("SELECT status,inventory_status FROM oms_order WHERE order_sn=? FOR UPDATE",description.get("order_sn"));
        Map<String,Object> event=db.queryForMap("SELECT * FROM oms_trade_event WHERE id=? FOR UPDATE",id);
        String type=(String)event.get("event_type");
        if(TradeMessages.TIMER.equals(type)) { if(!"CHECKED".equals(state)) throw new ApiProblem(409,"事件结果不匹配"); }
        else {
            int target;
            if(TradeMessages.DEDUCT.equals(type) && "DEDUCTED".equals(state)) target=1;
            else if(TradeMessages.RELEASE.equals(type) && "RELEASED".equals(state)) target=2;
            else throw new ApiProblem(409,"库存事件结果不匹配");
            int status=((Number)order.get("status")).intValue(), inventory=((Number)order.get("inventory_status")).intValue();
            if((target==1 && !Arrays.asList(1,2,3,9).contains(status)) || (target==2 && !Arrays.asList(4,9).contains(status)) || (inventory!=0 && inventory!=target)) throw new ApiProblem(409,"订单与库存决策不一致，禁止履约并需人工检查");
            db.update("UPDATE oms_order SET inventory_status=? WHERE order_sn=?",target,event.get("order_sn"));
        }
        db.update("UPDATE oms_trade_event SET consumed_at=COALESCE(consumed_at,NOW()),last_error=NULL WHERE id=?",id);
    }
    private void sent(long id,boolean success) {
        try { db.update("UPDATE oms_trade_event SET sent_at=IF(?,NOW(),sent_at),last_error=?,next_attempt=DATE_ADD(NOW(),INTERVAL 30 SECOND) WHERE id=? AND consumed_at IS NULL",success,success?null:"消息未获路由及发布确认，等待重发",id); }
        catch(Exception unavailable) { /* An unrecorded confirm is retried from the durable event. */ }
    }
    @Scheduled(fixedDelay=1000,initialDelay=3000) public void publish() {
        try {
            List<Map<String,Object>> due=db.queryForList("SELECT e.*,o.payment_deadline FROM oms_trade_event e JOIN oms_order o ON o.order_sn=e.order_sn WHERE e.consumed_at IS NULL AND e.next_attempt<=NOW() AND (e.event_type<>'CLOSE_TIMER' OR e.sent_at IS NULL) ORDER BY e.next_attempt,e.id LIMIT 20");
            for(Map<String,Object> event:due) {
                long id=((Number)event.get("id")).longValue();
                if(db.update("UPDATE oms_trade_event SET next_attempt=DATE_ADD(NOW(),INTERVAL 30 SECOND),attempts=attempts+1 WHERE id=? AND consumed_at IS NULL AND next_attempt<=NOW()",id)!=1) continue;
                String route="stock";
                if(TradeMessages.TIMER.equals(event.get("event_type"))) route=event.get("payment_deadline")!=null && ((Date)event.get("payment_deadline")).after(new Date())?"delay":"close";
                MessageProperties properties=new MessageProperties(); properties.setDeliveryMode(MessageDeliveryMode.PERSISTENT); properties.setContentType("application/json"); properties.setMessageId(Long.toString(id));
                Message message=new Message(JSON.toJSONBytes(Collections.singletonMap("eventId",id)),properties);
                CorrelationData correlation=new CorrelationData(id+":"+UUID.randomUUID().toString());
                try {
                    rabbit.send(TradeMessages.EXCHANGE,route,message,correlation);
                    correlation.getFuture().addCallback(confirm->sent(id,confirm.isAck() && correlation.getReturnedMessage()==null),failure->sent(id,false));
                } catch(Exception unavailable) { sent(id,false); }
            }
        } catch(Exception unavailable) { /* The database and broker can recover independently. */ }
    }
    public int retry(String sn) { return db.update("UPDATE oms_trade_event SET sent_at=NULL,next_attempt=NOW() WHERE order_sn=? AND consumed_at IS NULL",sn); }
}
