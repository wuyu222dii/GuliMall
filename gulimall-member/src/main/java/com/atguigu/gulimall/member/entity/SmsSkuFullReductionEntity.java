package com.atguigu.gulimall.member.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.math.BigDecimal;
import java.io.Serializable;
import java.util.Date;
import lombok.Data;

/**
 * Product Full Reduction Info
 * 
 * @author liurui
 * @email liurui@gmail.com
 * @date 2023-10-18 15:33:25
 */
@Data
@TableName("sms_sku_full_reduction")
public class SmsSkuFullReductionEntity implements Serializable {
	private static final long serialVersionUID = 1L;

	/**
	 * id
	 */
	@TableId
	private Long id;
	/**
	 * spu_id
	 */
	private Long skuId;
	/**
	 * Minimum amount
	 */
	private BigDecimal fullPrice;
	/**
	 * Reduction amount
	 */
	private BigDecimal reducePrice;
	/**
	 * Whether participates in other discounts
	 */
	private Integer addOther;

}
