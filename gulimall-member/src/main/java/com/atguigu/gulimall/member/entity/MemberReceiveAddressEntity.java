package com.atguigu.gulimall.member.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.annotation.TableField;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.io.Serializable;
import java.util.Date;
import lombok.Data;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;
import javax.validation.constraints.Pattern;

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
	@TableField(exist = false)
	@JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
	private String creationRequestId;
	/**
	 * Consignee name
	 */
	@NotBlank @Size(max = 100)
	private String name;
	/**
	 * Phone
	 */
	@NotBlank @Pattern(regexp = "[+0-9 ()-]{6,32}")
	private String phone;
	/**
	 * Postal code
	 */
	@Size(max = 255)
	private String postCode;
	/**
	 * Province/municipality
	 */
	@Size(max = 255)
	private String province;
	/**
	 * City
	 */
	@Size(max = 255)
	private String city;
	/**
	 * District
	 */
	@Size(max = 255)
	private String region;
	/**
	 * Detailed address (street)
	 */
	@NotBlank @Size(max = 255)
	private String detailAddress;
	/**
	 * Province/city/district code
	 */
	@Size(max = 255)
	private String areacode;
	/**
	 * Whether default
	 */
	private Integer defaultStatus;

}
