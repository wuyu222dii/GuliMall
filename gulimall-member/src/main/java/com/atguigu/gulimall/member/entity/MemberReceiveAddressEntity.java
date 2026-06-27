package com.atguigu.gulimall.member.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.io.Serializable;
import java.util.Date;
import lombok.Data;

/**
 * Member Receive Address
 * 
 * @author liurui
 * @email liurui@gmail.com
 * @date 2023-10-18 15:40:37
 */
@Data
@TableName("ums_member_receive_address")
public class MemberReceiveAddressEntity implements Serializable {
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
	 * Consignee name
	 */
	private String name;
	/**
	 * Phone
	 */
	private String phone;
	/**
	 * Postal code
	 */
	private String postCode;
	/**
	 * Province/municipality
	 */
	private String province;
	/**
	 * City
	 */
	private String city;
	/**
	 * District
	 */
	private String region;
	/**
	 * Detailed address (street)
	 */
	private String detailAddress;
	/**
	 * Province/city/district code
	 */
	private String areacode;
	/**
	 * Whether default
	 */
	private Integer defaultStatus;

}
