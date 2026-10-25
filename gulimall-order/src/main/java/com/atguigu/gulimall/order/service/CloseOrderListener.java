package com.atguigu.gulimall.order.service;
import com.fasterxml.jackson.databind.*;
import com.atguigu.common.constant.TradeMessages;
import com.rabbitmq.client.Channel;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import java.io.IOException;
import java.util.Map;
@Component
public class CloseOrderListener {
    @Autowired private TradeEventService events;
    @Autowired private PaymentSettlementService payments;
    @Autowired private ObjectMapper json;
    @RabbitListener(queues=TradeMessages.CLOSE_QUEUE) public void close(Message message,Channel channel) throws IOException {
        long tag=message.getMessageProperties().getDeliveryTag();
        try {
            if(message.getBody().length>1024) throw new IllegalArgumentException();
            JsonNode node=json.readTree(message.getBody()).path("eventId"); if(!node.isIntegralNumber() || !node.canConvertToLong() || node.longValue()<1) throw new IllegalArgumentException(); long id=node.longValue();
            Map<String,Object> event=events.descriptor(id); if(!TradeMessages.TIMER.equals(event.get("event_type"))) throw new IllegalArgumentException();
            payments.reconcile((String)event.get("order_sn")); events.completed(id,"CHECKED"); channel.basicAck(tag,false);
        } catch(Exception failed) { channel.basicNack(tag,false,false); }
    }
}
