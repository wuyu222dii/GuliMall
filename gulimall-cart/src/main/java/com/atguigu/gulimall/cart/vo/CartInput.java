package com.atguigu.gulimall.cart.vo;
import lombok.Data;
@Data
public class CartInput {
    private Long skuId;
    private Integer count;
    private Boolean checked;
    private String revision;
}
