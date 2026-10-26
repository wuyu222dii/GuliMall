package com.atguigu.gulimall.auth.service;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name="AUTH_SMS_MODE",havingValue="development")
public class DevelopmentSmsSender implements SmsSender {
    @Override public void send(String phone,String code,int validMinutes) {
        if(phone==null || !phone.matches("1[3-9][0-9]{9}") || code==null || !code.matches("[0-9]{6}") || validMinutes<1) throw new IllegalArgumentException("Invalid development SMS delivery");
        // Development delivery is shown in the development response; no external SMS is sent.
    }
}
