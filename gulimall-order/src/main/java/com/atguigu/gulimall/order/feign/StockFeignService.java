package com.atguigu.gulimall.order.feign;
import com.atguigu.common.to.StockLockTo;
import com.atguigu.common.utils.R;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.*;
@FeignClient(name="gulimall-ware",url="${ORDER_STOCK_URL:}")
public interface StockFeignService {
    @GetMapping("/internal/stock/{orderSn}") R status(@PathVariable("orderSn") String orderSn);
    @PostMapping("/internal/stock/lock") R lock(@RequestBody StockLockTo request);
    @PostMapping("/internal/stock/{orderSn}/release") R release(@PathVariable("orderSn") String orderSn);
}
