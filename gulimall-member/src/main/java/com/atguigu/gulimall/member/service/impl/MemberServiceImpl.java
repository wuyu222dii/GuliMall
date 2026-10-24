package com.atguigu.gulimall.member.service.impl;

import org.springframework.stereotype.Service;
import java.util.Map;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.atguigu.common.utils.PageUtils;
import com.atguigu.common.utils.Query;

import com.atguigu.gulimall.member.dao.MemberDao;
import com.atguigu.gulimall.member.entity.MemberEntity;
import com.atguigu.gulimall.member.service.MemberService;
import com.atguigu.common.security.*;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.dao.DuplicateKeyException;
import java.nio.charset.StandardCharsets;
import java.util.Date;


@Service("memberService")
public class MemberServiceImpl extends ServiceImpl<MemberDao, MemberEntity> implements MemberService {
    private final BCryptPasswordEncoder passwords = new BCryptPasswordEncoder();

    @Override
    public SessionUser register(RegistrationRequest request) {
        if (request.getPassword().getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new ApiProblem(400, "密码的 UTF-8 长度不能超过 72 字节");
        }
        MemberEntity member = new MemberEntity();
        member.setUsername(request.getUsername());
        member.setMobile(request.getPhone());
        member.setPassword(passwords.encode(request.getPassword()));
        member.setNickname(request.getUsername());
        member.setStatus(1);
        member.setIntegration(0);
        member.setGrowth(0);
        member.setCreateTime(new Date());
        try { save(member); } catch (DuplicateKeyException e) {
            throw new ApiProblem(409, "用户名或手机号已使用");
        }
        return new SessionUser(member.getId(), member.getUsername(), false);
    }

    @Override
    public SessionUser authenticate(Credentials credentials) {
        MemberEntity member = getOne(new QueryWrapper<MemberEntity>().eq(
                credentials.getUsername().matches("1[3-9][0-9]{9}") ? "mobile" : "username", credentials.getUsername()));
        String hash = member == null || member.getPassword() == null
                ? "$2a$10$PsG6KDbwvIJge8jv6eTqyOoRK.Rdh2ySm6QorJ3jfigbot1xAhFs2" : member.getPassword();
        boolean matches = passwords.matches(credentials.getPassword(), hash);
        if (!matches || member == null || !Integer.valueOf(1).equals(member.getStatus())) {
            throw new ApiProblem(401, "用户名或密码不正确");
        }
        return new SessionUser(member.getId(), member.getUsername(), false);
    }

    @Override
    public PageUtils queryPage(Map<String, Object> params) {
        IPage<MemberEntity> page = this.page(
                new Query<MemberEntity>().getPage(params),
                new QueryWrapper<MemberEntity>()
        );

        return new PageUtils(page);
    }

}
