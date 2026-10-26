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
import javax.annotation.PostConstruct;
import java.util.UUID;

@Service
public class VerificationCodeService {
    @Autowired private StringRedisTemplate redis;
    @Autowired private Environment environment;
    @Value("${AUTH_SMS_MODE:disabled}") private String mode;
    @Autowired(required=false) private SmsSender sender;
    private final SecureRandom random = new SecureRandom();

    @PostConstruct public void validateMode() {
        if(!"disabled".equals(mode) && !"development".equals(mode)) throw new IllegalStateException("Real SMS delivery is not implemented; use development or disabled");
        if("development".equals(mode) && (!environment.acceptsProfiles("dev") || environment.acceptsProfiles("prod","production") || sender==null)) throw new IllegalStateException("Development SMS requires dev profile and a development sender");
    }

    public String send(String phone) {
        if (!"development".equals(mode) || !environment.acceptsProfiles("dev") || environment.acceptsProfiles("prod", "production")) {
            throw new ApiProblem(503, "短信服务未启用");
        }
        String code = String.format(Locale.ROOT, "%06d", random.nextInt(1000000));
        String owner=UUID.randomUUID().toString();
        String script = "if redis.call('EXISTS',KEYS[1])==1 then return 0 end "
                + "redis.call('SET',KEYS[1],ARGV[2],'EX',60) redis.call('HSET',KEYS[2],'code',ARGV[1],'attempts',0,'owner',ARGV[2],'delivered',0) "
                + "redis.call('EXPIRE',KEYS[2],600) return 1";
        Long result = redis.execute(new DefaultRedisScript<>(script, Long.class), Arrays.asList("sms:rate:"+phone, "sms:code:"+phone), code,owner);
        if (!Long.valueOf(1).equals(result)) { throw new ApiProblem(429, "请在 60 秒后重新获取验证码"); }
        try {
            if(sender==null)throw new IllegalStateException("SMS sender unavailable");
            sender.send(phone,code,10);
            String delivered="if redis.call('HGET',KEYS[1],'owner')~=ARGV[1] then return 0 end redis.call('HSET',KEYS[1],'delivered',1) return 1";
            if(!Long.valueOf(1).equals(redis.execute(new DefaultRedisScript<>(delivered,Long.class),Collections.singletonList("sms:code:"+phone),owner)))throw new IllegalStateException("SMS delivery expired");
        } catch(RuntimeException failure) {
            String cleanup="if redis.call('HGET',KEYS[2],'owner')==ARGV[1] then redis.call('DEL',KEYS[2]) end if redis.call('GET',KEYS[1])==ARGV[1] then redis.call('DEL',KEYS[1]) end return 1";
            try {redis.execute(new DefaultRedisScript<>(cleanup,Long.class),Arrays.asList("sms:rate:"+phone,"sms:code:"+phone),owner);} catch(RuntimeException unavailable) { /* Undelivered entries remain unusable until expiry. */ }
            throw new ApiProblem(503,"验证码发送失败，请稍后重试");
        }
        return code;
    }
    public void verify(String phone, String code) {
        String script = "local c=redis.call('HGET',KEYS[1],'code') if not c or redis.call('HGET',KEYS[1],'delivered')=='0' then return 0 end "
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
