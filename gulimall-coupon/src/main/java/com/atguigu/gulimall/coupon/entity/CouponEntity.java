package com.atguigu.gulimall.coupon.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.math.BigDecimal;
import java.io.Serializable;
import java.util.Date;
import lombok.Data;

/**
 * Coupon info
 * 
 * @author liurui
 * @email liurui@gmail.com
 * @date 2023-10-18 15:26:25
 */
@Data
@TableName("sms_coupon")
public class CouponEntity implements Serializable {
	private static final long serialVersionUID = 1L;

	/**
	 * id
	 */
	@TableId
	private Long id;
	/**
	 * Coupon type [0-site-wide, 1-member, 2-shopping, 3-registration]
	 */
	private Integer couponType;
	/**
	 * Coupon image
	 */
	private String couponImg;
	/**
	 * Coupon name
	 */
	private String couponName;
	/**
	 * Quantity
	 */
	private Integer num;
	/**
	 * Amount
	 */
	private BigDecimal amount;
	/**
	 * Per-user claim limit
	 */
	private Integer perLimit;
	/**
	 * Minimum spend
	 */
	private BigDecimal minPoint;
	/**
	 * Start time
	 */
	private Date startTime;
	/**
	 * End time
	 */
	private Date endTime;
	/**
	 * Use type [0-all, 1-category, 2-product]
	 */
	private Integer useType;
	/**
	 * Remark
	 */
	private String note;
	/**
	 * Publish quantity
	 */
	private Integer publishCount;
	/**
	 * Used quantity
	 */
	private Integer useCount;
	/**
	 * Claimed quantity
	 */
	private Integer receiveCount;
	/**
	 * Claim start date
	 */
	private Date enableStartTime;
	/**
	 * Claim end date
	 */
	private Date enableEndTime;
	/**
	 * Promo code
	 */
	private String code;
	/**
	 * Member level [0-any, else specific level]
	 */
	private Integer memberLevel;
	/**
	 * Publish status [0-unpublished, 1-published]
	 */
	private Integer publish;

}
