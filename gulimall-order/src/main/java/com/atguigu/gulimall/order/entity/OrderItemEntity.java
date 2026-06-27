package com.atguigu.gulimall.order.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;

/**
 * Order item info
 * 
 * @author liurui
 * @email liurui@gmail.com
 * @date 2023-10-18 15:47:43
 */
@Data
@TableName("oms_order_item")
public class OrderItemEntity implements Serializable {
	private static final long serialVersionUID = 1L;

	/**
	 * id
	 */
	@TableId
	private Long id;
	/**
	 * order_id
	 */
	private Long orderId;
	/**
	 * order_sn
	 */
	private String orderSn;
	/**
	 * spu_id
	 */
	private Long spuId;
	/**
	 * spu_name
	 */
	private String spuName;
	/**
	 * spu_pic
	 */
	private String spuPic;
	/**
	 * Brand
	 */
	private String spuBrand;
	/**
	 * Product category id
	 */
	private Long categoryId;
	/**
	 * Product SKU id
	 */
	private Long skuId;
	/**
	 * Product SKU name
	 */
	private String skuName;
	/**
	 * Product SKU image
	 */
	private String skuPic;
	/**
	 * Product SKU price
	 */
	private BigDecimal skuPrice;
	/**
	 * Product purchase quantity
	 */
	private Integer skuQuantity;
	/**
	 * Product sale attribute combination (JSON)
	 */
	private String skuAttrsVals;
	/**
	 * Product promotion allocation amount
	 */
	private BigDecimal promotionAmount;
	/**
	 * Coupon discount allocation amount
	 */
	private BigDecimal couponAmount;
	/**
	 * Integration discount allocation amount
	 */
	private BigDecimal integrationAmount;
	/**
	 * Item amount after discount allocation
	 */
	private BigDecimal realAmount;
	/**
	 * Bonus integration points
	 */
	private Integer giftIntegration;
	/**
	 * Bonus growth value
	 */
	private Integer giftGrowth;

}
