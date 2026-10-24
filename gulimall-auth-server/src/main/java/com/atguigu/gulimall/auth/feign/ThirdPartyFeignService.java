package com.atguigu.gulimall.auth.feign;

import com.atguigu.common.utils.R;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;

@FeignClient("gulimall-third-party")
public interface ThirdPartyFeignService {


    @PostMapping("/internal/sms/sendcode")
    R sendCode(@RequestParam("phone") String phone,
               @RequestParam("code") String code,
               @RequestParam("minute") String minute);
}
