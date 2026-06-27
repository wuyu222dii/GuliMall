package com.atguigu.gulimall.member.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.io.Serializable;
import java.util.Date;
import lombok.Data;

/**
 * Home Carousel Advertisement
 * 
 * @author liurui
 * @email liurui@gmail.com
 * @date 2023-10-18 15:33:25
 */
@Data
@TableName("sms_home_adv")
public class SmsHomeAdvEntity implements Serializable {
	private static final long serialVersionUID = 1L;

	/**
	 * id
	 */
	@TableId
	private Long id;
	/**
	 * Name
	 */
	private String name;
	/**
	 * Image URL
	 */
	private String pic;
	/**
	 * Start time
	 */
	private Date startTime;
	/**
	 * End time
	 */
	private Date endTime;
	/**
	 * Status
	 */
	private Integer status;
	/**
	 * Click count
	 */
	private Integer clickCount;
	/**
	 * Advertisement detail link URL
	 */
	private String url;
	/**
	 * Remark
	 */
	private String note;
	/**
	 * Sort order
	 */
	private Integer sort;
	/**
	 * Publisher
	 */
	private Long publisherId;
	/**
	 * Reviewer
	 */
	private Long authId;

}
