package com.atguigu.gulimall.member.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.math.BigDecimal;
import java.io.Serializable;
import java.util.Date;
import lombok.Data;

/**
 * Member Statistics Info
 * 
 * @author liurui
 * @email liurui@gmail.com
 * @date 2023-10-18 15:40:37
 */
@Data
@TableName("ums_member_statistics_info")
public class MemberStatisticsInfoEntity implements Serializable {
	private static final long serialVersionUID = 1L;

	/**
	 * id
	 */
	@TableId
	private Long id;
	/**
	 * Member id
	 */
	private Long memberId;
	/**
	 * Total consumption amount
	 */
	private BigDecimal consumeAmount;
	/**
	 * Total discount amount
	 */
	private BigDecimal couponAmount;
	/**
	 * Order count
	 */
	private Integer orderCount;
	/**
	 * Coupon count
	 */
	private Integer couponCount;
	/**
	 * Review count
	 */
	private Integer commentCount;
	/**
	 * Return count
	 */
	private Integer returnOrderCount;
	/**
	 * Login count
	 */
	private Integer loginCount;
	/**
	 * Following count
	 */
	private Integer attendCount;
	/**
	 * Follower count
	 */
	private Integer fansCount;
	/**
	 * Number of collected products
	 */
	private Integer collectProductCount;
	/**
	 * Number of collected subject activities
	 */
	private Integer collectSubjectCount;
	/**
	 * Number of collected comments
	 */
	private Integer collectCommentCount;
	/**
	 * Number of invited friends
	 */
	private Integer inviteFriendCount;

}
