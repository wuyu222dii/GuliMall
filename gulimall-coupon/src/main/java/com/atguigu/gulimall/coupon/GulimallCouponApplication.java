package com.atguigu.gulimall.coupon;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

/**
 * 1)、命名空间：配置隔离；
 * 默认：public(保留空间)；默认新增的所有配置都在public空间
 * 1、开发，测试，生产：利用命名空间来做环境隔离
 * 注意：在bootstrap.properties配置上，需要使用那个命名空间下的配置
 * spring.cloud.nacos.config.namespace=6cf1e1fa-0e6b-4009-8150-2fe051f6904d
 * 2、每一个微服务之间相互隔离配置，每一个微服务都创建自己的命名空间，只加载自己命名空间
 * 2）、配置集：所有的配置的集合
 * 3）、配置集ID：类似文件名。
 * Data ID：类似文件名
 * 4）、配置分组：
 * 默认所有配置集都属于：DEFAULT_GROUP
 * 1111，618，1212
 * 每个微服务创建自己的命名空间，使用配置分组区分环境，dev，test，prod
 *
 * 3、同时加载多个配置集
 * 1）、微服务任何配置信息，任何配置文件都可以放在配置中心中
 * 2）、只需要在bootstrap.properties说明加载配置中心中那些配置文件即可
 * 3）、@Value，@ConfigurationProperties..
 * 以前SpringBoot任何方法从配置文件中获取值，都能使用。
 * 配置中心有的优先使用配置中心的
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
