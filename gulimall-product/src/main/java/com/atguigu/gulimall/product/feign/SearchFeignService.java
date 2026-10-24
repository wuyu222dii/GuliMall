package com.atguigu.gulimall.product.feign;
import com.atguigu.common.to.SearchSyncRequest;
import com.atguigu.common.utils.R;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.*;
@FeignClient("gulimall-search")
public interface SearchFeignService {
    @PostMapping("/internal/search/synchronize") R synchronize(@RequestBody SearchSyncRequest request);
}
