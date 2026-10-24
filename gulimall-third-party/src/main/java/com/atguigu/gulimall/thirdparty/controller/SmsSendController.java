package com.atguigu.gulimall.thirdparty.controller;

import com.atguigu.common.utils.R;
import com.atguigu.gulimall.thirdparty.component.SmsComponent;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@ConditionalOnProperty(name = "gulimall.sms.enabled", havingValue = "true")
@RequestMapping("/sms")
public class SmsSendController {

    /**
     * Send verification code to phone (for other services to call)
     *
     * @param phone
     * @return
     */
    @Autowired
    SmsComponent smsComponent;

    @GetMapping("/sendcode")
    public R sendCode(@RequestParam("phone") String phone,
                      @RequestParam("code") String code,
                      @RequestParam("minute") String minute) {
        smsComponent.sendCode(phone,code,minute);
        return R.ok();
    }
}
