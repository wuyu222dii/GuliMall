package com.atguigu.gulimall.order.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;
import java.util.Date;

/**
 * Order
 * 
 * @author liurui
 * @email liurui@gmail.com
 * @date 2023-10-18 15:47:43
 */
@Data
@TableName("oms_order")
public class OrderEntity implements Serializable {
	private static final long serialVersionUID = 1L;

	/**
	 * id
	 */
	@TableId
	private Long id;
	/**
	 * member_id
	 */
	private Long memberId;
	/**
	 * Order number
	 */
	private String orderSn;
	/**
	 * Coupon used
	 */
	private Long couponId;
	/**
	 * create_time
	 */
	private Date createTime;
	/**
	 * Username
	 */
	private String memberUsername;
	/**
	 * Order total amount
	 */
	private BigDecimal totalAmount;
	/**
	 * Payable amount
	 */
	private BigDecimal payAmount;
	/**
	 * Freight amount
	 */
	private BigDecimal freightAmount;
	/**
	 * Promotion discount amount (promotional price, full reduction, tiered pricing)
	 */
	private BigDecimal promotionAmount;
	/**
	 * Integration discount amount
	 */
	private BigDecimal integrationAmount;
	/**
	 * Coupon discount amount
	 */
	private BigDecimal couponAmount;
	/**
	 * Discount amount adjusted by admin
	 */
	private BigDecimal discountAmount;
	/**
	 * Payment method [1->Alipay; 2->WeChat; 3->UnionPay; 4->Cash on delivery]
	 */
	private Integer payType;
	/**
	 * Order source [0->PC order; 1->App order]
	 */
	private Integer sourceType;
	/**
	 * Order status [0->Pending payment; 1->Pending shipment; 2->Shipped; 3->Completed; 4->Closed; 5->Invalid order]
	 */
	private Integer status;
	/**
	 * Logistics company (delivery method)
	 */
	private String deliveryCompany;
	/**
	 * Tracking number
	 */
	private String deliverySn;
	/**
	 * Auto confirm time (days)
	 */
	private Integer autoConfirmDay;
	/**
	 * Integration points to earn
	 */
	private Integer integration;
	/**
	 * Growth value to earn
	 */
	private Integer growth;
	/**
	 * Invoice type [0->No invoice; 1->Electronic invoice; 2->Paper invoice]
	 */
	private Integer billType;
	/**
	 * Invoice title
	 */
	private String billHeader;
	/**
	 * Invoice content
	 */
	private String billContent;
	/**
	 * Invoice receiver phone
	 */
	private String billReceiverPhone;
	/**
	 * Invoice receiver email
	 */
	private String billReceiverEmail;
	/**
	 * Receiver name
	 */
	private String receiverName;
	/**
	 * Receiver phone
	 */
	private String receiverPhone;
	/**
	 * Receiver postal code
	 */
	private String receiverPostCode;
	/**
	 * Province/municipality
	 */
	private String receiverProvince;
	/**
	 * City
	 */
	private String receiverCity;
	/**
	 * District
	 */
	private String receiverRegion;
	/**
	 * Detailed address
	 */
	private String receiverDetailAddress;
	/**
	 * Order note
	 */
	private String note;
	/**
	 * Confirm receipt status [0->Unconfirmed; 1->Confirmed]
	 */
	private Integer confirmStatus;
	/**
	 * Delete status [0->Not deleted; 1->Deleted]
	 */
	private Integer deleteStatus;
	/**
	 * Integration points used when placing order
	 */
	private Integer useIntegration;
	/**
	 * Payment time
	 */
	private Date paymentTime;
	/**
	 * Shipment time
	 */
	private Date deliveryTime;
	/**
	 * Confirm receipt time
	 */
	private Date receiveTime;
	/**
	 * Review time
	 */
	private Date commentTime;
	/**
	 * Modification time
	 */
	private Date modifyTime;

}
