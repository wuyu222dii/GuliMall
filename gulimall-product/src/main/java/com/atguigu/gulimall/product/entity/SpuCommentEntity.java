package com.atguigu.gulimall.product.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.io.Serializable;
import java.util.Date;
import lombok.Data;

/**
 * Product evaluation
 * 
 * @author liurui
 * @email liurui@gmail.com
 * @date 2023-10-18 13:34:55
 */
@Data
@TableName("pms_spu_comment")
public class SpuCommentEntity implements Serializable {
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
	 * spu_id
	 */
	private Long spuId;
	/**
	 * Product name
	 */
	private String spuName;
	/**
	 * Member nickname
	 */
	private String memberNickName;
	/**
	 * star rating
	 */
	private Integer star;
	/**
	 * memberip
	 */
	private String memberIp;
	/**
	 * creation time
	 */
	private Date createTime;
	/**
	 * Show status[0-Not displayed,1-show]
	 */
	private Integer showStatus;
	/**
	 * Attribute combination at the time of purchase
	 */
	private String spuAttributes;
	/**
	 * Number of likes
	 */
	private Integer likesCount;
	/**
	 * Number of replies
	 */
	private Integer replyCount;
	/**
	 * Comment on pictures/video[jsondata;[{type:File type,url:Resource path}]]
	 */
	private String resources;
	/**
	 * content
	 */
	private String content;
	/**
	 * User avatar
	 */
	private String memberIcon;
	/**
	 * Comment type[0 - Direct reviews of products,1 - Reply to comment]
	 */
	private Integer commentType;

}
