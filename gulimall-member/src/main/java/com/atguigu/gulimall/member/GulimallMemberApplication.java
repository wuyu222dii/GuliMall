package com.atguigu.gulimall.member;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.cloud.openfeign.EnableFeignClients;

@SpringBootApplication
@MapperScan("com.atguigu.gulimall.member.dao")
@EnableDiscoveryClient
@EnableFeignClients(basePackages = "com.atguigu.gulimall.member.feign")
public class GulimallMemberApplication {
    @org.springframework.context.annotation.Bean
    public com.baomidou.mybatisplus.extension.plugins.PaginationInterceptor paginationInterceptor() {
        return new com.baomidou.mybatisplus.extension.plugins.PaginationInterceptor();
    }

    public static void main(String[] args) {
        SpringApplication.run(GulimallMemberApplication.class, args);
    }

}
