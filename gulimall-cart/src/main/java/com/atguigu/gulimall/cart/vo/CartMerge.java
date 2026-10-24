package com.atguigu.gulimall.cart.vo;
import lombok.Data;
import java.util.List;
@Data
public class CartMerge {
    private String mergeId;
    private List<CartInput> items;
}
