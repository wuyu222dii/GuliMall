package com.atguigu.gulimall.coupon.dao;

import com.atguigu.gulimall.coupon.entity.SkuLadderEntity;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * SKU tiered pricing
 * 
 * @author liurui
 * @email liurui@gmail.com
 * @date 2023-10-18 15:26:25
 */
@Mapper
public interface SkuLadderDao extends BaseMapper<SkuLadderEntity> {
	
}
