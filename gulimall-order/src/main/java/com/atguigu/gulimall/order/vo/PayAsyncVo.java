package com.atguigu.gulimall.order.vo;

import lombok.Data;
import lombok.ToString;

import java.util.Date;

@ToString
@Data
public class PayAsyncVo {

    private String gmt_create;
    private String charset;
    private String gmt_payment;
    private Date notify_time;
    private String subject;
    private String sign;
    private String buyer_id;// Payer id
    private String body;// Order info
    private String invoice_amount;// Payment amount
    private String version;
    private String notify_id;// Notification id
    private String fund_bill_list;
    private String notify_type;// Notification type; trade_status_sync
    private String out_trade_no;// Order number
    private String total_amount;// Total payment amount
    private String trade_status;// Transaction status TRADE_SUCCESS
    private String trade_no;// Transaction serial number
    private String auth_app_id;//
    private String receipt_amount;// Amount received by merchant
    private String point_amount;//
    private String app_id;// Application id
    private String buyer_pay_amount;// Final payment amount
    private String sign_type;// Signature type
    private String seller_id;// Merchant id

}
