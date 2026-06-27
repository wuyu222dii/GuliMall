package com.atguigu.gulimall.coupon;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

/**
 * 1) Namespace: configuration isolation;
 * Default: public (reserved); all new configs go in the public namespace
 * Use namespaces to isolate dev, test, and prod environments
 * Note: in bootstrap.properties, specify which namespace to load
 * spring.cloud.nacos.config.namespace=6cf1e1fa-0e6b-4009-8150-2fe051f6904d
 * 2) Each microservice creates its own namespace and loads only its configs
 * 2) Configuration set: collection of all configs
 * 3) Configuration set ID: like a filename.
 * Data ID: like a filename
 * 4) Configuration group:
 * By default all config sets belong to DEFAULT_GROUP
 * 1111，618，1212
 * Each microservice uses its namespace; use groups for dev, test, prod
 *
 * 3) Load multiple configuration sets at once
 * 1) Any microservice config can live in the config center
 * 2) Declare which config-center files to load in bootstrap.properties
 * 3）、@Value，@ConfigurationProperties..
 * Values can still be read the same way as from local Spring Boot config.
 * Config center values take precedence when present
 *
 *
 */
@SpringBootApplication
@MapperScan("com.atguigu.gulimall.coupon.dao")
@EnableDiscoveryClient
public class GulimallCouponApplication {

    public static void main(String[] args) {
        SpringApplication.run(GulimallCouponApplication.class, args);
    }

}
