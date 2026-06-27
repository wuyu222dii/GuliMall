package com.atguigu.gulimall.order.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;
import java.util.Date;

/**
 * Order return application
 * 
 * @author liurui
 * @email liurui@gmail.com
 * @date 2023-10-18 15:47:43
 */
@Data
@TableName("oms_order_return_apply")
public class OrderReturnApplyEntity implements Serializable {
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
	 * Return product id
	 */
	private Long skuId;
	/**
	 * Order number
	 */
	private String orderSn;
	/**
	 * Application time
	 */
	private Date createTime;
	/**
	 * Member username
	 */
	private String memberUsername;
	/**
	 * Refund amount
	 */
	private BigDecimal returnAmount;
	/**
	 * Returner name
	 */
	private String returnName;
	/**
	 * Returner phone
	 */
	private String returnPhone;
	/**
	 * Application status [0->Pending; 1->Returning; 2->Completed; 3->Rejected]
	 */
	private Integer status;
	/**
	 * Processing time
	 */
	private Date handleTime;
	/**
	 * Product image
	 */
	private String skuImg;
	/**
	 * Product name
	 */
	private String skuName;
	/**
	 * Product brand
	 */
	private String skuBrand;
	/**
	 * Product sale attributes (JSON)
	 */
	private String skuAttrsVals;
	/**
	 * Return quantity
	 */
	private Integer skuCount;
	/**
	 * Product unit price
	 */
	private BigDecimal skuPrice;
	/**
	 * Actual unit price paid
	 */
	private BigDecimal skuRealPrice;
	/**
	 * Reason
	 */
	private String reason;
	/**
	 * Description
	 */
	private String description;
	/**
	 * Proof images, comma-separated
	 */
	private String descPics;
	/**
	 * Processing remark
	 */
	private String handleNote;
	/**
	 * Processor
	 */
	private String handleMan;
	/**
	 * Receiver
	 */
	private String receiveMan;
	/**
	 * Receipt time
	 */
	private Date receiveTime;
	/**
	 * Receipt remark
	 */
	private String receiveNote;
	/**
	 * Receipt phone
	 */
	private String receivePhone;
	/**
	 * Company receiving address
	 */
	private String companyAddress;

}
