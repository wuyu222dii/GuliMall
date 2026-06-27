package com.atguigu.gulimall.member.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.atguigu.common.utils.PageUtils;
import com.atguigu.gulimall.member.entity.SmsHomeSubjectEntity;

import java.util.Map;

/**
 * Home Subject [JD homepage has many subjects below; each subject links to a new page showing subject product info]
 *
 * @author liurui
 * @email liurui@gmail.com
 * @date 2023-10-18 15:33:25
 */
public interface SmsHomeSubjectService extends IService<SmsHomeSubjectEntity> {

    PageUtils queryPage(Map<String, Object> params);
}

