package com.atguigu.gulimall.member.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.atguigu.common.utils.PageUtils;
import com.atguigu.gulimall.member.entity.SmsSkuLadderEntity;

import java.util.Map;

/**
 * Product Tiered Price
 *
 * @author liurui
 * @email liurui@gmail.com
 * @date 2023-10-18 15:33:25
 */
public interface SmsSkuLadderService extends IService<SmsSkuLadderEntity> {

    PageUtils queryPage(Map<String, Object> params);
}

