package com.atguigu.common.security;

import feign.RequestInterceptor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConditionalOnClass(RequestInterceptor.class)
public class FeignSecurityConfiguration {
    @Bean
    public RequestInterceptor internalAuthentication(@Value("${INTERNAL_API_TOKEN}") String token) {
        if (token.length() < 32) { throw new IllegalStateException("INTERNAL_API_TOKEN must have at least 32 characters"); }
        return template -> template.header("X-Internal-Token", token);
    }
}
