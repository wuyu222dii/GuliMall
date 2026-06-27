package com.atguigu.gulimall.ware.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.math.BigDecimal;
import java.io.Serializable;
import java.util.Date;
import lombok.Data;

/**
 * 
 * 
 * @author liurui
 * @email liurui@gmail.com
 * @date 2023-10-18 15:52:12
 */
@Data
@TableName("wms_purchase_detail")
public class PurchaseDetailEntity implements Serializable {
	private static final long serialVersionUID = 1L;

	/**
	 * 
	 */
	@TableId
	private Long id;
	/**
	 * Purchase order id
	 */
	private Long purchaseId;
	/**
	 * Purchased product id
	 */
	private Long skuId;
	/**
	 * Purchase quantity
	 */
	private Integer skuNum;
	/**
	 * Purchase amount
	 */
	private BigDecimal skuPrice;
	/**
	 * Warehouse id
	 */
	private Long wareId;
	/**
	 * Status [0-new, 1-assigned, 2-in progress, 3-completed, 4-failed]
	 */
	private Integer status;

}
