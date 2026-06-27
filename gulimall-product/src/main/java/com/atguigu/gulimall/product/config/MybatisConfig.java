package com.atguigu.gulimall.product.config;

import com.baomidou.mybatisplus.extension.plugins.PaginationInterceptor;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.transaction.annotation.EnableTransactionManagement;

@Configuration
@EnableTransactionManagement
@MapperScan("com.atguigu.gulimall.product.dao")
public class MybatisConfig {

    // Introduce paging plugin
    @Bean
    public PaginationInterceptor paginationInterceptor() {
        PaginationInterceptor paginationInterceptor = new PaginationInterceptor();
        // Set the requested page to be greater than the maximum page and then operate,trueReturn to the homepage,falseContinue request Defaultfalse
        paginationInterceptor.setOverflow(true);
        // Set the maximum number of single page limits, default500strip,-1 Unrestricted
        paginationInterceptor.setLimit(1000);
        return paginationInterceptor;
    }
}
