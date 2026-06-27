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
@TableName("wms_ware_order_task_detail")
public class WareOrderTaskDetailEntity implements Serializable {
	private static final long serialVersionUID = 1L;

	/**
	 * id
	 */
	@TableId
	private Long id;
	/**
	 * sku_id
	 */
	private Long skuId;
	/**
	 * sku_name
	 */
	private String skuName;
	/**
	 * Quantity purchased
	 */
	private Integer skuNum;
	/**
	 * Task id
	 */
	private Long taskId;
	/**
	 * Warehouse id
	 */
	private Long wareId;
	/**
	 * 1-locked  2-unlocked  3-deducted
	 */
	private Integer lockStatus;

}
