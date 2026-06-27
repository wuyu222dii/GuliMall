package com.atguigu.gulimall.coupon.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.math.BigDecimal;
import java.io.Serializable;
import java.util.Date;
import lombok.Data;

/**
 * Member price
 * 
 * @author liurui
 * @email liurui@gmail.com
 * @date 2023-10-18 15:26:25
 */
@Data
@TableName("sms_member_price")
public class MemberPriceEntity implements Serializable {
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
	 * Member price
	 */
	private BigDecimal memberPrice;
	/**
	 * Stack with other promos [0-no, 1-yes]
	 */
	private Integer addOther;

}
