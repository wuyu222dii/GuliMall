package com.atguigu.common.to;
import lombok.Data;
@Data
public class OrderLineTo extends CartProductTo {
    private Integer count;
    private String revision;
}
