package com.atguigu.gulimall.order.vo;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

public class OrderConfirmVo {

    @Getter
    @Setter
    /** Member shipping address list **/
    private List<MemberAddressVo> memberAddressVos;

    @Getter @Setter
    /** All selected cart items **/
    private List<OrderItemVo> items;

    /** Invoice record **/
    @Getter @Setter
    /** Coupons (member integration points) **/
    private Integer integration;

    /** Token to prevent duplicate submission **/
    @Getter @Setter
    private String orderToken;

    @Getter @Setter
    Map<Long,Boolean> stocks;

    public Integer getCount() {
        Integer count = 0;
        if (items != null && items.size() > 0) {
            for (OrderItemVo item : items) {
                count += item.getCount();
            }
        }
        return count;
    }


    /** Order total amount **/
    //BigDecimal total;
    // Calculate order total amount
    public BigDecimal getTotal() {
        BigDecimal totalNum = BigDecimal.ZERO;
        if (items != null && items.size() > 0) {
            for (OrderItemVo item : items) {
                // Calculate total price for current item
                BigDecimal itemPrice = item.getPrice().multiply(new BigDecimal(item.getCount().toString()));
                // Then calculate total price for all items
                totalNum = totalNum.add(itemPrice);
            }
        }
        return totalNum;
    }


    /** Payable amount **/
    //BigDecimal payPrice;
    public BigDecimal getPayPrice() {
        return getTotal();
    }
}
