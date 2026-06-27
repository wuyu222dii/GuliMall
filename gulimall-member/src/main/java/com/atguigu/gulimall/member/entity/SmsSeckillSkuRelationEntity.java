package com.atguigu.gulimall.member.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.math.BigDecimal;
import java.io.Serializable;
import java.util.Date;
import lombok.Data;

/**
 * Seckill Activity Product Relation
 * 
 * @author liurui
 * @email liurui@gmail.com
 * @date 2023-10-18 15:33:25
 */
@Data
@TableName("sms_seckill_sku_relation")
public class SmsSeckillSkuRelationEntity implements Serializable {
	private static final long serialVersionUID = 1L;

	/**
	 * id
	 */
	@TableId
	private Long id;
	/**
	 * Activity id
	 */
	private Long promotionId;
	/**
	 * Activity session id
	 */
	private Long promotionSessionId;
	/**
	 * Product id
	 */
	private Long skuId;
	/**
	 * Seckill price
	 */
	private BigDecimal seckillPrice;
	/**
	 * Seckill total quantity
	 */
	private Integer seckillCount;
	/**
	 * Purchase limit per person
	 */
	private Integer seckillLimit;
	/**
	 * Sort order
	 */
	private Integer seckillSort;

}
