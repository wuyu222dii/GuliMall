package com.atguigu.gulimall.member.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.math.BigDecimal;
import java.io.Serializable;
import java.util.Date;
import lombok.Data;

/**
 * Member Level
 * 
 * @author liurui
 * @email liurui@gmail.com
 * @date 2023-10-18 15:40:37
 */
@Data
@TableName("ums_member_level")
public class MemberLevelEntity implements Serializable {
	private static final long serialVersionUID = 1L;

	/**
	 * id
	 */
	@TableId
	private Long id;
	/**
	 * Level name
	 */
	private String name;
	/**
	 * Growth points required for level
	 */
	private Integer growthPoint;
	/**
	 * Whether default level [0->no; 1->yes]
	 */
	private Integer defaultStatus;
	/**
	 * Free shipping threshold
	 */
	private BigDecimal freeFreightPoint;
	/**
	 * Growth points earned per review
	 */
	private Integer commentGrowthPoint;
	/**
	 * Whether has free shipping privilege
	 */
	private Integer priviledgeFreeFreight;
	/**
	 * Whether has member price privilege
	 */
	private Integer priviledgeMemberPrice;
	/**
	 * Whether has birthday privilege
	 */
	private Integer priviledgeBirthday;
	/**
	 * Remark
	 */
	private String note;

}
