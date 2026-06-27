package com.atguigu.gulimall.member.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.atguigu.common.utils.PageUtils;
import com.atguigu.gulimall.member.entity.SmsCouponSpuRelationEntity;

import java.util.Map;

/**
 * Coupon and Product Relation
 *
 * @author liurui
 * @email liurui@gmail.com
 * @date 2023-10-18 15:33:25
 */
public interface SmsCouponSpuRelationService extends IService<SmsCouponSpuRelationEntity> {

    PageUtils queryPage(Map<String, Object> params);
}

