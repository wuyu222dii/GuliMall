package com.atguigu.gulimall.order.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serializable;
import java.util.Date;

/**
 * Order operation history
 * 
 * @author liurui
 * @email liurui@gmail.com
 * @date 2023-10-18 15:47:43
 */
@Data
@TableName("oms_order_operate_history")
public class OrderOperateHistoryEntity implements Serializable {
	private static final long serialVersionUID = 1L;

	/**
	 * id
	 */
	@TableId
	private Long id;
	/**
	 * Order id
	 */
	private Long orderId;
	/**
	 * Operator [user; system; admin]
	 */
	private String operateMan;
	/**
	 * Operation time
	 */
	private Date createTime;
	/**
	 * Order status [0->Pending payment; 1->Pending shipment; 2->Shipped; 3->Completed; 4->Closed; 5->Invalid order]
	 */
	private Integer orderStatus;
	/**
	 * Remark
	 */
	private String note;

}
