package com.atguigu.gulimall.order;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

@SpringBootApplication
@MapperScan("com.atguigu.gulimall.order.dao")
@EnableDiscoveryClient
@org.springframework.cloud.openfeign.EnableFeignClients
@org.springframework.scheduling.annotation.EnableScheduling
public class GulimallOrderApplication {
    @org.springframework.context.annotation.Bean
    public com.baomidou.mybatisplus.extension.plugins.PaginationInterceptor paginationInterceptor() {
        return new com.baomidou.mybatisplus.extension.plugins.PaginationInterceptor();
    }

    public static void main(String[] args) {
        SpringApplication.run(GulimallOrderApplication.class, args);
    }

}
