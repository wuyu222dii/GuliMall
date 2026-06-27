package com.atguigu.gulimall.member.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.math.BigDecimal;
import java.io.Serializable;
import java.util.Date;
import lombok.Data;

/**
 * Product Tiered Price
 * 
 * @author liurui
 * @email liurui@gmail.com
 * @date 2023-10-18 15:33:25
 */
@Data
@TableName("sms_sku_ladder")
public class SmsSkuLadderEntity implements Serializable {
	private static final long serialVersionUID = 1L;

	/**
	 * id
	 */
	@TableId
	private Long id;
	/**
	 * spu_id
	 */
	private Long skuId;
	/**
	 * Minimum quantity
	 */
	private Integer fullCount;
	/**
	 * Discount rate
	 */
	private BigDecimal discount;
	/**
	 * Discounted price
	 */
	private BigDecimal price;
	/**
	 * Whether stackable with other discounts [0-not stackable, 1-stackable]
	 */
	private Integer addOther;

}
