package com.atguigu.gulimall.ware.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.annotation.TableField;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.io.Serializable;
import java.util.Date;
import lombok.Data;

/**
 * Warehouse info
 * 
 * @author liurui
 * @email liurui@gmail.com
 * @date 2023-10-18 15:52:12
 */
@Data
@TableName("wms_ware_info")
public class WareInfoEntity implements Serializable {
	private static final long serialVersionUID = 1L;

	/**
	 * id
	 */
	@TableId
	private Long id;
	@TableField(exist = false)
	@JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
	private String creationRequestId;
	/**
	 * Warehouse name
	 */
	private String name;
	/**
	 * Warehouse address
	 */
	private String address;
	/**
	 * Area code
	 */
	private String areacode;

}
