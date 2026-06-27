package com.atguigu.gulimall.product.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.math.BigDecimal;
import java.io.Serializable;
import java.util.Date;
import lombok.Data;

/**
 * skuinformation
 * 
 * @author liurui
 * @email liurui@gmail.com
 * @date 2023-10-18 13:34:55
 */
@Data
@TableName("pms_sku_info")
public class SkuInfoEntity implements Serializable {
	private static final long serialVersionUID = 1L;

	/**
	 * skuId
	 */
	@TableId
	private Long skuId;
	/**
	 * spuId
	 */
	private Long spuId;
	/**
	 * skuname
	 */
	private String skuName;
	/**
	 * skuIntroduction description
	 */
	private String skuDesc;
	/**
	 * Categoryid
	 */
	private Long catalogId;
	/**
	 * brandid
	 */
	private Long brandId;
	/**
	 * Default picture
	 */
	private String skuDefaultImg;
	/**
	 * title
	 */
	private String skuTitle;
	/**
	 * subtitle
	 */
	private String skuSubtitle;
	/**
	 * price
	 */
	private BigDecimal price;
	/**
	 * Sales volume
	 */
	private Long saleCount;

}
