package com.atguigu.gulimall.coupon.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.io.Serializable;
import java.util.Date;
import lombok.Data;

/**
 * Coupon claim history
 * 
 * @author liurui
 * @email liurui@gmail.com
 * @date 2023-10-18 15:26:25
 */
@Data
@TableName("sms_coupon_history")
public class CouponHistoryEntity implements Serializable {
	private static final long serialVersionUID = 1L;

	/**
	 * id
	 */
	@TableId
	private Long id;
	/**
	 * Coupon id
	 */
	private Long couponId;
	/**
	 * Member id
	 */
	private Long memberId;
	/**
	 * Member name
	 */
	private String memberNickName;
	/**
	 * Obtain method [0-admin grant, 1-self claim]
	 */
	private Integer getType;
	/**
	 * Create time
	 */
	private Date createTime;
	/**
	 * Use status [0-unused, 1-used, 2-expired]
	 */
	private Integer useType;
	/**
	 * Use time
	 */
	private Date useTime;
	/**
	 * Order id
	 */
	private Long orderId;
	/**
	 * Order sn
	 */
	private Long orderSn;

}
