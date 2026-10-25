package com.atguigu.gulimall.order.feign;
import com.atguigu.common.to.StockLockTo;
import com.atguigu.common.utils.R;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.*;
@FeignClient("gulimall-cart")
public interface CartFeignService {
    @GetMapping("/internal/cart/{memberId}/selected") R selected(@PathVariable("memberId") long memberId);
    @PostMapping("/internal/cart/{memberId}/ordered") R ordered(@PathVariable("memberId") long memberId,@RequestBody StockLockTo request);
}
