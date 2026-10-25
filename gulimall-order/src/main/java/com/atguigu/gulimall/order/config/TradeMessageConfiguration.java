package com.atguigu.gulimall.order.config;
import com.atguigu.common.constant.TradeMessages;
import org.springframework.amqp.core.*;
import org.springframework.context.annotation.*;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
@Configuration
public class TradeMessageConfiguration {
    @Bean public Declarables tradeTopology() {
        DirectExchange exchange=new DirectExchange(TradeMessages.EXCHANGE,true,false);
        Queue stock=QueueBuilder.durable(TradeMessages.STOCK_QUEUE).withArgument("x-dead-letter-exchange",TradeMessages.EXCHANGE).withArgument("x-dead-letter-routing-key","dead").build();
        Queue close=QueueBuilder.durable(TradeMessages.CLOSE_QUEUE).withArgument("x-dead-letter-exchange",TradeMessages.EXCHANGE).withArgument("x-dead-letter-routing-key","dead").build();
        Queue delay=QueueBuilder.durable(TradeMessages.DELAY_QUEUE).withArgument("x-message-ttl",1800000).withArgument("x-dead-letter-exchange",TradeMessages.EXCHANGE).withArgument("x-dead-letter-routing-key","close").build();
        Queue dead=new Queue(TradeMessages.DEAD_QUEUE,true);
        return new Declarables(exchange,stock,close,delay,dead,BindingBuilder.bind(stock).to(exchange).with("stock"),BindingBuilder.bind(close).to(exchange).with("close"),BindingBuilder.bind(delay).to(exchange).with("delay"),BindingBuilder.bind(dead).to(exchange).with("dead"));
    }
    @Bean public ThreadPoolTaskScheduler taskScheduler() {
        ThreadPoolTaskScheduler scheduler=new ThreadPoolTaskScheduler(); scheduler.setPoolSize(3); scheduler.setThreadNamePrefix("order-recovery-"); return scheduler;
    }
}
