package com.atguigu.common.exception;

import lombok.Getter;
import lombok.Setter;

public class NoStockException extends RuntimeException{

    @Setter @Getter
    private Long skuId;

    public NoStockException(Long skuId) {
        super("Product id:" + skuId + "; insufficient stock");
    }

    public NoStockException(String message) {
        super(message);
    }
}
