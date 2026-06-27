package com.atguigu.gulimall.member.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.math.BigDecimal;
import java.io.Serializable;
import java.util.Date;
import lombok.Data;

/**
 * Product SPU Points Settings
 * 
 * @author liurui
 * @email liurui@gmail.com
 * @date 2023-10-18 15:33:25
 */
@Data
@TableName("sms_spu_bounds")
public class SmsSpuBoundsEntity implements Serializable {
	private static final long serialVersionUID = 1L;

	/**
	 * id
	 */
	@TableId
	private Long id;
	/**
	 * 
	 */
	private Long spuId;
	/**
	 * Growth points
	 */
	private BigDecimal growBounds;
	/**
	 * Shopping points
	 */
	private BigDecimal buyBounds;
	/**
	 * Discount effect status [1111 (four status bits, right to left); 0 - no discount, whether growth points are given; 1 - no discount, whether shopping points are given; 2 - with discount, whether growth points are given; 3 - with discount, whether shopping points are given [status bit 0: not given, 1: given]]
	 */
	private Integer work;

}
