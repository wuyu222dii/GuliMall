package com.atguigu.gulimall.auth.feign;

import com.atguigu.common.security.*;
import com.atguigu.common.utils.R;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.*;

@FeignClient("gulimall-member")
public interface MemberIdentityFeignService {
    @PostMapping("/internal/member/register") R register(@RequestBody RegistrationRequest request);
    @PostMapping("/internal/member/login") R login(@RequestBody Credentials request);
}
