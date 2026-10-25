package com.atguigu.gulimall.ware.feign;
import com.atguigu.common.utils.R;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
@FeignClient(name="gulimall-order",url="${WARE_ORDER_EVENT_URL:}")
public interface OrderEventFeignService {
    @GetMapping("/internal/order/events/{id}") R descriptor(@PathVariable("id") long id);
    @PostMapping("/internal/order/events/{id}/complete") R complete(@PathVariable("id") long id,@RequestBody Map<String,String> state);
}
