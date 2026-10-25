package com.atguigu.gulimall.ware.service;
import com.atguigu.common.constant.TradeMessages;
import com.atguigu.common.utils.R;
import com.atguigu.gulimall.ware.feign.OrderEventFeignService;
import com.fasterxml.jackson.databind.*;
import com.rabbitmq.client.Channel;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import java.io.IOException;
import java.util.*;
@Component
public class StockSettlementListener {
    @Autowired private StockReservationService stock;
    @Autowired private OrderEventFeignService orders;
    @Autowired private ObjectMapper json;
    @RabbitListener(queues=TradeMessages.STOCK_QUEUE) public void settle(Message message,Channel channel) throws IOException {
        long tag=message.getMessageProperties().getDeliveryTag();
        try {
            if(message.getBody().length>1024) throw new IllegalArgumentException();
            JsonNode node=json.readTree(message.getBody()).path("eventId"); if(!node.isIntegralNumber() || !node.canConvertToLong() || node.longValue()<1) throw new IllegalArgumentException();
            long id=node.longValue(); R event=orders.descriptor(id); if(event.getCode()!=0) throw new IllegalStateException();
            Map<?,?> descriptor=(Map<?,?>)event.get("data"); String sn=(String)descriptor.get("order_sn"), type=(String)descriptor.get("event_type"); Map<String,Object> result;
            if(TradeMessages.DEDUCT.equals(type)) result=stock.deduct(sn);
            else if(TradeMessages.RELEASE.equals(type)) result=stock.release(sn);
            else throw new IllegalArgumentException();
            if(orders.complete(id,Collections.singletonMap("state",(String)result.get("state"))).getCode()!=0) throw new IllegalStateException();
            channel.basicAck(tag,false);
        } catch(Exception failed) { channel.basicNack(tag,false,false); }
    }
}
