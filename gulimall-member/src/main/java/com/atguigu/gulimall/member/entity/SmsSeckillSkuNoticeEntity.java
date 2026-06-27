package com.atguigu.gulimall.member.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.io.Serializable;
import java.util.Date;
import lombok.Data;

/**
 * Seckill Product Notification Subscription
 * 
 * @author liurui
 * @email liurui@gmail.com
 * @date 2023-10-18 15:33:25
 */
@Data
@TableName("sms_seckill_sku_notice")
public class SmsSeckillSkuNoticeEntity implements Serializable {
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
	 * Activity session id
	 */
	private Long sessionId;
	/**
	 * Subscription time
	 */
	private Date subcribeTime;
	/**
	 * Send time
	 */
	private Date sendTime;
	/**
	 * Notification method [0-SMS, 1-email]
	 */
	private Integer noticeType;

}
