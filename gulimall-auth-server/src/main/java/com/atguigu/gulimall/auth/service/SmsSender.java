package com.atguigu.gulimall.auth.service;

public interface SmsSender {
    void send(String phone,String code,int validMinutes);
}
