package com.atguigu.gulimall.order.feign;
import com.atguigu.common.utils.R;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.*;
@FeignClient("gulimall-member")
public interface MemberFeignService {
    @GetMapping("/internal/member/{memberId}/addresses") R addresses(@PathVariable("memberId") long memberId);
    @GetMapping("/internal/member/{memberId}/addresses/{id}") R address(@PathVariable("memberId") long memberId,@PathVariable("id") long id);
}
