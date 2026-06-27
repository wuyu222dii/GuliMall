package com.atguigu.gulimall.ware.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.io.Serializable;
import java.util.Date;
import lombok.Data;

/**
 * Warehouse order task
 * 
 * @author liurui
 * @email liurui@gmail.com
 * @date 2023-10-18 15:52:12
 */
@Data
@TableName("wms_ware_order_task")
public class WareOrderTaskEntity implements Serializable {
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
	 * Consignee
	 */
	private String consignee;
	/**
	 * Consignee phone
	 */
	private String consigneeTel;
	/**
	 * Delivery address
	 */
	private String deliveryAddress;
	/**
	 * Order remark
	 */
	private String orderComment;
	/**
	 * Payment method [1: online, 2: cash on delivery]
	 */
	private Integer paymentWay;
	/**
	 * Task status
	 */
	private Integer taskStatus;
	/**
	 * Order description
	 */
	private String orderBody;
	/**
	 * Tracking number
	 */
	private String trackingNo;
	/**
	 * create_time
	 */
	private Date createTime;
	/**
	 * Warehouse id
	 */
	private Long wareId;
	/**
	 * Task remark
	 */
	private String taskComment;

}
