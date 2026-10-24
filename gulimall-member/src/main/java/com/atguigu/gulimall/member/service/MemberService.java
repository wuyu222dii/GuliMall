package com.atguigu.gulimall.member.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.atguigu.common.utils.PageUtils;
import com.atguigu.gulimall.member.entity.MemberEntity;

import java.util.Map;
import com.atguigu.common.security.Credentials;
import com.atguigu.common.security.RegistrationRequest;
import com.atguigu.common.security.SessionUser;

/**
 * Member
 *
 * @author liurui
 * @email liurui@gmail.com
 * @date 2023-10-18 15:40:37
 */
public interface MemberService extends IService<MemberEntity> {

    PageUtils queryPage(Map<String, Object> params);
    SessionUser register(RegistrationRequest request);
    SessionUser authenticate(Credentials credentials);
}

