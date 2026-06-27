package com.atguigu.gulimall.member.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.io.Serializable;
import java.util.Date;
import lombok.Data;

/**
 * Seckill Promotion
 * 
 * @author liurui
 * @email liurui@gmail.com
 * @date 2023-10-18 15:33:25
 */
@Data
@TableName("sms_seckill_promotion")
public class SmsSeckillPromotionEntity implements Serializable {
	private static final long serialVersionUID = 1L;

	/**
	 * id
	 */
	@TableId
	private Long id;
	/**
	 * Activity title
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
