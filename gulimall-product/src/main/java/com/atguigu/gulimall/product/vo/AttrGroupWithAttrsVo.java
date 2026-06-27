package com.atguigu.gulimall.product.vo;

import com.atguigu.gulimall.product.entity.AttrEntity;
import lombok.Data;

import java.util.List;
@Data
public class AttrGroupWithAttrsVo {
    /**
     * Groupid
     */
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

    private List<AttrEntity> attrs;
}
