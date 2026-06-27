package com.atguigu.gulimall.order.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serializable;

/**
 * Order settings
 * 
 * @author liurui
 * @email liurui@gmail.com
 * @date 2023-10-18 15:47:43
 */
@Data
@TableName("oms_order_setting")
public class OrderSettingEntity implements Serializable {
	private static final long serialVersionUID = 1L;

	/**
	 * id
	 */
	@TableId
	private Long id;
	/**
	 * Flash sale order timeout (minutes)
	 */
	private Integer flashOrderOvertime;
	/**
	 * Normal order timeout (minutes)
	 */
	private Integer normalOrderOvertime;
	/**
	 * Auto confirm receipt time after shipment (days)
	 */
	private Integer confirmOvertime;
	/**
	 * Auto complete transaction time, no returns allowed (days)
	 */
	private Integer finishOvertime;
	/**
	 * Auto positive review time after order completion (days)
	 */
	private Integer commentOvertime;
	/**
	 * Member level [0-All levels; other-corresponding member level]
	 */
	private Integer memberLevel;

}
