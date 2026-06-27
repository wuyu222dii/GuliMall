package com.atguigu.gulimall.member.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.math.BigDecimal;
import java.io.Serializable;
import java.util.Date;
import lombok.Data;

/**
 * Coupon Info
 * 
 * @author liurui
 * @email liurui@gmail.com
 * @date 2023-10-18 15:33:25
 */
@Data
@TableName("sms_coupon")
public class SmsCouponEntity implements Serializable {
	private static final long serialVersionUID = 1L;

	/**
	 * id
	 */
	@TableId
	private Long id;
	/**
	 * Coupon type [0->store-wide gift; 1->member gift; 2->shopping gift; 3->registration gift]
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
	 * Claim limit per person
	 */
	private Integer perLimit;
	/**
	 * Usage threshold
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
	 * Usage type [0->store-wide; 1->specified category; 2->specified product]
	 */
	private Integer useType;
	/**
	 * Remark
	 */
	private String note;
	/**
	 * Published quantity
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
	 * Eligible member levels [0->no level limit, others-corresponding level]
	 */
	private Integer memberLevel;
	/**
	 * Publish status [0-unpublished, 1-published]
	 */
	private Integer publish;

}
