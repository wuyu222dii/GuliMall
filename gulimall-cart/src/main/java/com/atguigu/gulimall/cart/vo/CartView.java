package com.atguigu.gulimall.cart.vo;
import lombok.Data;
import java.math.BigDecimal;
import java.util.List;
@Data
public class CartView {
    private List<CartLine> items;
    private int totalCount;
    private int checkedCount;
    private BigDecimal totalAmount;
    private boolean readyToCheckout;
}
