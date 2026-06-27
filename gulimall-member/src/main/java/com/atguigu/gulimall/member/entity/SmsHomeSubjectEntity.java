package com.atguigu.gulimall.member.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.io.Serializable;
import java.util.Date;
import lombok.Data;

/**
 * Home Subject [JD homepage has many subjects below; each subject links to a new page showing subject product info]
 * 
 * @author liurui
 * @email liurui@gmail.com
 * @date 2023-10-18 15:33:25
 */
@Data
@TableName("sms_home_subject")
public class SmsHomeSubjectEntity implements Serializable {
	private static final long serialVersionUID = 1L;

	/**
	 * id
	 */
	@TableId
	private Long id;
	/**
	 * Subject name
	 */
	private String name;
	/**
	 * Subject title
	 */
	private String title;
	/**
	 * Subject subtitle
	 */
	private String subTitle;
	/**
	 * Display status
	 */
	private Integer status;
	/**
	 * Detail link
	 */
	private String url;
	/**
	 * Sort order
	 */
	private Integer sort;
	/**
	 * Subject image URL
	 */
	private String img;

}
