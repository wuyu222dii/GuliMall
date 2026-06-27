package com.atguigu.gulimall.order.vo;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class OrderSubmitVo {

    /** Shipping address id **/
    private Long addrId;

    /** Payment method **/
    private Integer payType;
    // No need to submit items to purchase; fetch from cart again
    // Discounts, invoice

    /** Duplicate submission token **/
    private String orderToken;

    /** Payable amount **/
    private BigDecimal payPrice;

    /** Order note **/
    private String remarks;

    // User-related info can be retrieved directly from session
}
