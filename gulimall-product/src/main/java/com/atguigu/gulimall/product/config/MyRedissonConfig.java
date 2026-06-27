package com.atguigu.gulimall.product.config;

import org.redisson.Redisson;
import org.redisson.api.RedissonClient;
import org.redisson.config.Config;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class MyRedissonConfig {

    /**
     * all pairsredissonare used throughRedissonClientobject
     *
     * @return
     * @throws Exception
     */
    @Bean(destroyMethod = "shutdown")
    RedissonClient redisson() throws Exception {
        // 1, create configuration
        Config config = new Config();
        config.useSingleServer()
                .setAddress("redis://127.0.0.1:6379");
        // 2,according toConfigcreateRedissonClientExample
        RedissonClient redissonClient = Redisson.create(config);
        return redissonClient;
    }
}
