package com.atguigu.gulimall.search.vo;

import lombok.Data;

@Data
public class AttrResponseVo {
    /**
     * propertyid
     */
    private Long attrId;
    /**
     * attribute name
     */
    private String attrName;
    /**
     * Do you need to search[0-unnecessary,1-need]
     */
    private Integer searchType;
    /**
     * value type[0-is a single value,1-Multiple values ​​can be selected]
     */
    private Integer valueType;
    /**
     * Property icon
     */
    private String icon;
    /**
     * list of optional values[separated by commas]
     */
    private String valueSelect;
    /**
     * Property type[0-sales properties,1-Basic properties
     */
    private Integer attrType;
    /**
     * Enabled status[0 - disabled,1 - enable]
     */
    private Long enable;
    /**
     * Category
     */
    private Long catelogId;
    /**
     * Quick display [whether to display on the introduction;0-no 1-Yes], inskucan still be adjusted in
     */
    private Integer showDesc;

    private Long attrGroupId;

    /**
     * "catelogName":"cell phone/digital/cell phone",//Category name
     * "groupName":"main body",//Group name
     */
    private String catelogName;
    private String groupName;
    private Long[] catelogPath;
}
