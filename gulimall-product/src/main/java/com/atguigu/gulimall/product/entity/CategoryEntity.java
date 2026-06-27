package com.atguigu.gulimall.product.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;

import java.io.Serializable;
import java.util.Date;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

/**
 * Three-level classification of goods
 *
 * @author liurui
 * @email liurui@gmail.com
 * @date 2023-10-18 13:34:55
 */
@Data
@TableName("pms_category")
public class CategoryEntity implements Serializable {
    private static final long serialVersionUID = 1L;

    /**
     * Classificationid
     */
    @TableId
    private Long catId;
    /**
     * Category name
     */
    private String name;
    /**
     * Parent categoryid
     */
    private Long parentCid;
    /**
     * Hierarchy
     */
    private Integer catLevel;
    /**
     * Whether to display[0-Not displayed,1show]
     */
    @TableLogic(value = "1",delval = "0")
    private Integer showStatus;
    /**
     * sort
     */
    private Integer sort;
    /**
     * Icon address
     */
    private String icon;
    /**
     * unit of measurement
     */
    private String productUnit;
    /**
     * Product quantity
     */
    private Integer productCount;

    /**
     * Custom properties
     */
    @JsonInclude(JsonInclude.Include.NON_EMPTY)
    @TableField(exist = false)
    private List<CategoryEntity> children;

}
