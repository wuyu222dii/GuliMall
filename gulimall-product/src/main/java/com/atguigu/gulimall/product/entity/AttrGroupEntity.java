package com.atguigu.gulimall.product.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.io.Serializable;
import java.util.Date;

import lombok.Data;

/**
 * Attribute grouping
 *
 * @author liurui
 * @email liurui@gmail.com
 * @date 2023-10-18 13:34:55
 */
@Data
@TableName("pms_attr_group")
public class AttrGroupEntity implements Serializable {
    private static final long serialVersionUID = 1L;

    /**
     * Groupid
     */
    @TableId
    private Long attrGroupId;
    /**
     * Group name
     */
    private String attrGroupName;
    /**
     * sort
     */
    private Integer sort;
    /**
     * describe
     */
    private String descript;
    /**
     * group icon
     */
    private String icon;
    /**
     * Categoryid
     */
    private Long catelogId;

    @TableField(exist = false)
    private Long[] catelogPath;

}
