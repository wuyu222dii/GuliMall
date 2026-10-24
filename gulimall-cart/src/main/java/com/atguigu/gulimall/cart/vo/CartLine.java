package com.atguigu.gulimall.cart.vo;
import com.atguigu.common.to.CartProductTo;
import lombok.Data;
@Data
public class CartLine extends CartProductTo {
    private int count;
    private boolean checked;
    private String status;
    private String message;
    public boolean isPurchasable() { return "AVAILABLE".equals(status); }
}
