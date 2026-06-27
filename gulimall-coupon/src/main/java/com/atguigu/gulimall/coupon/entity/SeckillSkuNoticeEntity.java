package com.atguigu.gulimall.coupon.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.io.Serializable;
import java.util.Date;
import lombok.Data;

/**
 * Seckill SKU notification subscription
 * 
 * @author liurui
 * @email liurui@gmail.com
 * @date 2023-10-18 15:26:26
 */
@Data
@TableName("sms_seckill_sku_notice")
public class SeckillSkuNoticeEntity implements Serializable {
	private static final long serialVersionUID = 1L;

	/**
	 * id
	 */
	@TableId
	private Long id;
	/**
	 * member_id
	 */
	private Long memberId;
	/**
	 * sku_id
	 */
	private Long skuId;
	/**
	 * Session id
	 */
	private Long sessionId;
	/**
	 * Subscribe time
	 */
	private Date subcribeTime;
	/**
	 * Send time
	 */
	private Date sendTime;
	/**
	 * Notify method [0-SMS, 1-email]
	 */
	private Integer noticeType;

}
