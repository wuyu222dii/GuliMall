package com.atguigu.gulimall.coupon.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.io.Serializable;
import java.util.Date;
import lombok.Data;

/**
 * Seckill session
 * 
 * @author liurui
 * @email liurui@gmail.com
 * @date 2023-10-18 15:26:26
 */
@Data
@TableName("sms_seckill_session")
public class SeckillSessionEntity implements Serializable {
	private static final long serialVersionUID = 1L;

	/**
	 * id
	 */
	@TableId
	private Long id;
	/**
	 * Session name
	 */
	private String name;
	/**
	 * Daily start time
	 */
	private Date startTime;
	/**
	 * Daily end time
	 */
	private Date endTime;
	/**
	 * Enabled status
	 */
	private Integer status;
	/**
	 * Create time
	 */
	private Date createTime;

}
