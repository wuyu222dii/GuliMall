package com.atguigu.gulimall.member.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.math.BigDecimal;
import java.io.Serializable;
import java.util.Date;
import lombok.Data;

/**
 * Product Member Price
 * 
 * @author liurui
 * @email liurui@gmail.com
 * @date 2023-10-18 15:33:25
 */
@Data
@TableName("sms_member_price")
public class SmsMemberPriceEntity implements Serializable {
	private static final long serialVersionUID = 1L;

	/**
	 * id
	 */
	@TableId
	private Long id;
	/**
	 * sku_id
	 */
	private Long skuId;
	/**
	 * Member level id
	 */
	private Long memberLevelId;
	/**
	 * Member level name
	 */
	private String memberLevelName;
	/**
	 * Member corresponding price
	 */
	private BigDecimal memberPrice;
	/**
	 * Whether stackable with other discounts [0-not stackable, 1-stackable]
	 */
	private Integer addOther;

}
