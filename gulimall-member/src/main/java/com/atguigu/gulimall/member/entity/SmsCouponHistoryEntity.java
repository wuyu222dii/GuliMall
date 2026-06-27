package com.atguigu.gulimall.member.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.io.Serializable;
import java.util.Date;
import lombok.Data;

/**
 * Coupon Redemption History
 * 
 * @author liurui
 * @email liurui@gmail.com
 * @date 2023-10-18 15:33:25
 */
@Data
@TableName("sms_coupon_history")
public class SmsCouponHistoryEntity implements Serializable {
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
	 * Acquisition method [0->admin gift; 1->self claim]
	 */
	private Integer getType;
	/**
	 * Create time
	 */
	private Date createTime;
	/**
	 * Usage status [0->unused; 1->used; 2->expired]
	 */
	private Integer useType;
	/**
	 * Usage time
	 */
	private Date useTime;
	/**
	 * Order id
	 */
	private Long orderId;
	/**
	 * Order number
	 */
	private Long orderSn;

}
