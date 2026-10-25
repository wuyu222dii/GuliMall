package com.atguigu.gulimall.gateway;

import com.atguigu.gulimall.gateway.config.GulimallCorsConfiguration;
import org.junit.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.web.cors.reactive.CorsWebFilter;
import reactor.core.publisher.Mono;
import java.util.concurrent.atomic.AtomicBoolean;
import static org.junit.Assert.*;

public class LocalOriginTest {
    @Test public void staticAndViteOriginsAreAllowedButForeignOriginsAreRejected() {
        CorsWebFilter filter=new GulimallCorsConfiguration().corsWebFilter();
        for(String origin:new String[]{"http://127.0.0.1:8080","http://127.0.0.1:5173","https://untrusted.example"}) {
            MockServerWebExchange exchange=MockServerWebExchange.from(MockServerHttpRequest.post("http://127.0.0.1:88/api/auth/login").header("Origin",origin));
            AtomicBoolean forwarded=new AtomicBoolean();
            filter.filter(exchange,e->{forwarded.set(true);return Mono.empty();}).block();
            if(origin.endsWith(".example")) {assertFalse(forwarded.get());assertEquals(HttpStatus.FORBIDDEN,exchange.getResponse().getStatusCode());}
            else {assertTrue(forwarded.get());assertEquals(origin,exchange.getResponse().getHeaders().getFirst("Access-Control-Allow-Origin"));}
        }
    }
}
