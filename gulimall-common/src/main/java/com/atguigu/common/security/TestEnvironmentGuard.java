package com.atguigu.common.security;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.Ordered;
import org.springframework.core.env.ConfigurableEnvironment;

public class TestEnvironmentGuard implements EnvironmentPostProcessor,Ordered {
    @Override public int getOrder() { return Ordered.LOWEST_PRECEDENCE; }
    @Override public void postProcessEnvironment(ConfigurableEnvironment environment,SpringApplication application) {
        if(environment.acceptsProfiles("test") && (!"1".equals(environment.getProperty("GULIMALL_TEST")) || !"gulimall-test".equals(environment.getProperty("COMPOSE_PROJECT_NAME")))) throw new IllegalStateException("The test profile requires scripts/test.ps1 and the isolated gulimall-test environment");
    }
}
