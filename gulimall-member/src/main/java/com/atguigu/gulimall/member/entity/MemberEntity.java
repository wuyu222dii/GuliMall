package com.atguigu.gulimall.member.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.io.Serializable;
import java.util.Date;
import lombok.Data;

/**
 * Member
 * 
 * @author liurui
 * @email liurui@gmail.com
 * @date 2023-10-18 15:40:37
 */
@Data
@TableName("ums_member")
public class MemberEntity implements Serializable {
	private static final long serialVersionUID = 1L;

	/**
	 * id
	 */
	@TableId
	private Long id;
	/**
	 * Member level id
	 */
	private Long levelId;
	/**
	 * Username
	 */
	private String username;
	/**
	 * Password
	 */
	private String password;
	/**
	 * Nickname
	 */
	private String nickname;
	/**
	 * Mobile phone number
	 */
	private String mobile;
	/**
	 * Email
	 */
	private String email;
	/**
	 * Avatar
	 */
	private String header;
	/**
	 * Gender
	 */
	private Integer gender;
	/**
	 * Birthday
	 */
	private Date birth;
	/**
	 * City
	 */
	private String city;
	/**
	 * Occupation
	 */
	private String job;
	/**
	 * Personal signature
	 */
	private String sign;
	/**
	 * User source
	 */
	private Integer sourceType;
	/**
	 * Integration points
	 */
	private Integer integration;
	/**
	 * Growth value
	 */
	private Integer growth;
	/**
	 * Enable status
	 */
	private Integer status;
	/**
	 * Registration time
	 */
	private Date createTime;
	/**
	 * Social user unique id
	 */
	private String socialUid;
	/**
	 * Access token
	 */
	private String accessToken;
	/**
	 * Access token expiration time
	 */
	private String expiresIn;

}
