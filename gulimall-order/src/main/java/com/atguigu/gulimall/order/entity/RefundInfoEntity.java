package com.atguigu.gulimall.order.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;

/**
 * Refund info
 * 
 * @author liurui
 * @email liurui@gmail.com
 * @date 2023-10-18 15:47:43
 */
@Data
@TableName("oms_refund_info")
public class RefundInfoEntity implements Serializable {
	private static final long serialVersionUID = 1L;

	/**
	 * id
	 */
	@TableId
	private Long id;
	/**
	 * Refund order
	 */
	private Long orderReturnId;
	/**
	 * Refund amount
	 */
	private BigDecimal refund;
	/**
	 * Refund transaction serial number
	 */
	private String refundSn;
	/**
	 * Refund status
	 */
	private Integer refundStatus;
	/**
	 * Refund channel [1-Alipay, 2-WeChat, 3-UnionPay, 4-Wire transfer]
	 */
	private Integer refundChannel;
	/**
	 * 
	 */
	private String refundContent;

}
