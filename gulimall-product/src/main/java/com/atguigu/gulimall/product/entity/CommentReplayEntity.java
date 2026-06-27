package com.atguigu.gulimall.product.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.io.Serializable;
import java.util.Date;
import lombok.Data;

/**
 * Product evaluation reply relationship
 * 
 * @author liurui
 * @email liurui@gmail.com
 * @date 2023-10-18 13:34:55
 */
@Data
@TableName("pms_comment_replay")
public class CommentReplayEntity implements Serializable {
	private static final long serialVersionUID = 1L;

	/**
	 * id
	 */
	@TableId
	private Long id;
	/**
	 * Commentid
	 */
	private Long commentId;
	/**
	 * replyid
	 */
	private Long replyId;

}
