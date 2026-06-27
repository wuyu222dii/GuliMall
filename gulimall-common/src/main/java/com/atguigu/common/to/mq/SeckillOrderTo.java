package com.atguigu.common.to.mq;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class SeckillOrderTo {
    /**
     * Order number
     */
    private String orderSn;

    /**
     * Promotion session id
     */
    private Long promotionSessionId;
    /**
     * Product id
     */
    private Long skuId;
    /**
     * Seckill price
     */
    private BigDecimal seckillPrice;

    /**
     * Purchase quantity
     */
    private Integer num;

    /**
     * Member id
     */
    private Long memberId;
}
