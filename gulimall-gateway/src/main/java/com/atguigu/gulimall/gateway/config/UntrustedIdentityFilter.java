package com.atguigu.gulimall.gateway.config;

import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.core.Ordered;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

@Component
public class UntrustedIdentityFilter implements GlobalFilter, Ordered {
    @Override public int getOrder() { return -100; }
    @Override public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        return chain.filter(exchange.mutate().request(exchange.getRequest().mutate().headers(headers -> {
            headers.remove("X-Internal-Token");
            headers.remove("X-Member-Id");
            headers.remove("X-User-Id");
            headers.remove("X-Role");
            headers.remove("X-Admin");
        }).build()).build());
    }
}
