package com.atguigu.gulimall.ware.config;

import com.baomidou.mybatisplus.extension.plugins.PaginationInterceptor;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.transaction.annotation.EnableTransactionManagement;

@Configuration
@EnableTransactionManagement
@MapperScan("com.atguigu.gulimall.ware.dao")
public class MybatisConfig {
    // Enable pagination plugin
    @Bean
    public PaginationInterceptor paginationInterceptor() {
        PaginationInterceptor paginationInterceptor = new PaginationInterceptor();
        // When page exceeds max: true returns to first page, false continues; default false
        paginationInterceptor.setOverflow(true);
        // Max records per page; default 500, -1 for unlimited
        paginationInterceptor.setLimit(1000);
        return paginationInterceptor;
    }
}
