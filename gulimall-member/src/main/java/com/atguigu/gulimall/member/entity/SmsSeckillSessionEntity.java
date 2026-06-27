package com.atguigu.gulimall.member.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.io.Serializable;
import java.util.Date;
import lombok.Data;

/**
 * Seckill Session
 * 
 * @author liurui
 * @email liurui@gmail.com
 * @date 2023-10-18 15:33:25
 */
@Data
@TableName("sms_seckill_session")
public class SmsSeckillSessionEntity implements Serializable {
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
	 * Enable status
	 */
	private Integer status;
	/**
	 * Create time
	 */
	private Date createTime;

}
