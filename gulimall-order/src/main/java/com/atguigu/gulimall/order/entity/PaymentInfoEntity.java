package com.atguigu.gulimall.order.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;
import java.util.Date;

/**
 * Payment info
 * 
 * @author liurui
 * @email liurui@gmail.com
 * @date 2023-10-18 15:47:43
 */
@Data
@TableName("oms_payment_info")
public class PaymentInfoEntity implements Serializable {
	private static final long serialVersionUID = 1L;

	/**
	 * id
	 */
	@TableId
	private Long id;
	/**
	 * Order number (external business number)
	 */
	private String orderSn;
	/**
	 * Order id
	 */
	private Long orderId;
	/**
	 * Alipay transaction serial number
	 */
	private String alipayTradeNo;
	/**
	 * Total payment amount
	 */
	private BigDecimal totalAmount;
	/**
	 * Transaction content
	 */
	private String subject;
	/**
	 * Payment status
	 */
	private String paymentStatus;
	/**
	 * Creation time
	 */
	private Date createTime;
	/**
	 * Confirmation time
	 */
	private Date confirmTime;
	/**
	 * Callback content
	 */
	private String callbackContent;
	/**
	 * Callback time
	 */
	private Date callbackTime;

}
