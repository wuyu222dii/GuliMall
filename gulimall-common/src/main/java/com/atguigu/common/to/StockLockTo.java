package com.atguigu.common.to;
import lombok.Data;
import java.util.List;
@Data
public class StockLockTo {
    private String orderSn;
    private List<OrderLineTo> items;
}
