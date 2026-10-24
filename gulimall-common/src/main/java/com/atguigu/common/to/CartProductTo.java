package com.atguigu.common.to;

import lombok.Data;
import java.math.BigDecimal;

@Data
public class CartProductTo {
    private Long skuId;
    private String skuName;
    private String skuDefaultImg;
    private BigDecimal price;
    private boolean onSale;
    private Boolean hasStock;
}
