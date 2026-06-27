package com.atguigu.gulimall.coupon.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.io.Serializable;
import java.util.Date;
import lombok.Data;

/**
 * Seckill promotion
 * 
 * @author liurui
 * @email liurui@gmail.com
 * @date 2023-10-18 15:26:26
 */
@Data
@TableName("sms_seckill_promotion")
public class SeckillPromotionEntity implements Serializable {
	private static final long serialVersionUID = 1L;

	/**
	 * id
	 */
	@TableId
	private Long id;
	/**
	 * Promotion title
	 */
	private String title;
	/**
	 * Start date
	 */
	private Date startTime;
	/**
	 * End date
	 */
	private Date endTime;
	/**
	 * Online/offline status
	 */
	private Integer status;
	/**
	 * Create time
	 */
	private Date createTime;
	/**
	 * Creator
	 */
	private Long userId;

}
