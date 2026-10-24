package com.atguigu.gulimall.member.controller;

import com.atguigu.common.security.*;
import com.atguigu.common.utils.R;
import com.atguigu.gulimall.member.service.MemberService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import javax.validation.Valid;

@RestController
@RequestMapping("/internal/member")
public class InternalIdentityController {
    @Autowired private MemberService members;
    @PostMapping("/register")
    public R register(@Valid @RequestBody RegistrationRequest request) {
        return R.ok().put("user", members.register(request));
    }
    @PostMapping("/login")
    public R login(@Valid @RequestBody Credentials request) {
        return R.ok().put("user", members.authenticate(request));
    }
}
