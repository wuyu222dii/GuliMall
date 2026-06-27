package com.atguigu.gulimall.order.vo;

import lombok.Data;

@Data
public class PayVo {
    private String out_trade_no; // Merchant order number (required)
    private String subject; // Order name (required)
    private String total_amount;  // Payment amount (required)
    private String body; // Product description (optional)
}
