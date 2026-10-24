package com.atguigu.gulimall.auth.service;

import com.atguigu.common.security.ApiProblem;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Collections;
import java.util.Locale;
import org.springframework.core.env.Environment;

@Service
public class VerificationCodeService {
    @Autowired private StringRedisTemplate redis;
    @Autowired private Environment environment;
    @Value("${AUTH_SMS_MODE:disabled}") private String mode;
    private final SecureRandom random = new SecureRandom();

    public String send(String phone) {
        if (!"development".equals(mode) || !environment.acceptsProfiles("dev") || environment.acceptsProfiles("prod", "production")) {
            throw new ApiProblem(503, "短信服务未启用");
        }
        String code = String.format(Locale.ROOT, "%06d", random.nextInt(1000000));
        String script = "if redis.call('EXISTS',KEYS[1])==1 then return 0 end "
                + "redis.call('SET',KEYS[1],'1','EX',60) redis.call('HSET',KEYS[2],'code',ARGV[1],'attempts',0) "
                + "redis.call('EXPIRE',KEYS[2],600) return 1";
        Long result = redis.execute(new DefaultRedisScript<>(script, Long.class), Arrays.asList("sms:rate:"+phone, "sms:code:"+phone), code);
        if (!Long.valueOf(1).equals(result)) { throw new ApiProblem(429, "请在 60 秒后重新获取验证码"); }
        return code;
    }
    public void verify(String phone, String code) {
        String script = "local c=redis.call('HGET',KEYS[1],'code') if not c then return 0 end "
                + "if tonumber(redis.call('HGET',KEYS[1],'attempts') or '0')>=5 then return 0 end "
                + "if c~=ARGV[1] then redis.call('HINCRBY',KEYS[1],'attempts',1) return 0 end return 1";
        Long result = redis.execute(new DefaultRedisScript<>(script, Long.class), Collections.singletonList("sms:code:"+phone), code);
        if (!Long.valueOf(1).equals(result)) { throw new ApiProblem(400, "验证码不正确、已过期或尝试次数过多"); }
    }
    public void consume(String phone, String code) {
        String script = "if redis.call('HGET',KEYS[1],'code')==ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0";
        redis.execute(new DefaultRedisScript<>(script, Long.class), Collections.singletonList("sms:code:"+phone), code);
    }
}
