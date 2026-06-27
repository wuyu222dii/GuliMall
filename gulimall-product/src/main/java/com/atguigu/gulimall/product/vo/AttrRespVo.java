package com.atguigu.gulimall.product.vo;

import lombok.Data;

@Data
public class AttrRespVo extends AttrVo {
    /**
     * "catelogName":"cell phone/digital/cell phone",//Category name
     * "groupName":"main body",//Group name
     */
    private String catelogName;
    private String groupName;
    private Long[] catelogPath;
}
