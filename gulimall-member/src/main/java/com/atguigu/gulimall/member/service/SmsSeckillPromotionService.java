package com.atguigu.gulimall.member.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.atguigu.common.utils.PageUtils;
import com.atguigu.gulimall.member.entity.SmsSeckillPromotionEntity;

import java.util.Map;

/**
 * Seckill Promotion
 *
 * @author liurui
 * @email liurui@gmail.com
 * @date 2023-10-18 15:33:25
 */
public interface SmsSeckillPromotionService extends IService<SmsSeckillPromotionEntity> {

    PageUtils queryPage(Map<String, Object> params);
}

