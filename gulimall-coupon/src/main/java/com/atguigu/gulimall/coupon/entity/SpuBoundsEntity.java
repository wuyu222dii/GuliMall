package com.atguigu.gulimall.coupon.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.math.BigDecimal;
import java.io.Serializable;
import java.util.Date;
import lombok.Data;

/**
 * SPU points settings
 * 
 * @author liurui
 * @email liurui@gmail.com
 * @date 2023-10-18 15:26:25
 */
@Data
@TableName("sms_spu_bounds")
public class SpuBoundsEntity implements Serializable {
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
	 * Promo flags [4 bits R-to-L: 0-no promo growth pts; 1-no promo shopping pts; 2-promo growth pts; 3-promo shopping pts; 0=none, 1=grant]
	 */
	private Integer work;

}
