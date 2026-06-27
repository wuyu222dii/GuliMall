package com.atguigu.gulimall.coupon.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.math.BigDecimal;
import java.io.Serializable;
import java.util.Date;
import lombok.Data;

/**
 * Seckill SKU relation
 * 
 * @author liurui
 * @email liurui@gmail.com
 * @date 2023-10-18 15:26:25
 */
@Data
@TableName("sms_seckill_sku_relation")
public class SeckillSkuRelationEntity implements Serializable {
	private static final long serialVersionUID = 1L;

	/**
	 * id
	 */
	@TableId
	private Long id;
	/**
	 * Promotion id
	 */
	private Long promotionId;
	/**
	 * Session id
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
	 * Seckill total
	 */
	private Integer seckillCount;
	/**
	 * Per-user limit
	 */
	private Integer seckillLimit;
	/**
	 * Sort order
	 */
	private Integer seckillSort;

}
