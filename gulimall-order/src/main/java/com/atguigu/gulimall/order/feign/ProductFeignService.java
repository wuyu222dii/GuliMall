package com.atguigu.gulimall.order.feign;
import com.atguigu.common.utils.R;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.*;
import java.util.List;
@FeignClient("gulimall-product")
public interface ProductFeignService {
    @PostMapping("/internal/product/cart-items") R products(@RequestBody List<Long> ids,@RequestParam("inventory") boolean inventory);
}
