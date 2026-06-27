package com.atguigu.gulimall.ware.feign;

import com.atguigu.common.utils.R;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;

@FeignClient("gulimall-product")
public interface ProductFeignService {

    /**
     *
     * 1) Route all requests through the gateway:
     *        1. @FeignClient("gulimall-gateway"): send requests to the gateway instance
     *        2、"/api/product/skuinfo/info/{skuId}"
     * 2) Or have a specific backend server handle the request directly
     *        1、@FeignClient("gulimall-product")：
     *        2、"/product/skuinfo/info/{skuId}"
     *
     * @param skuId
     * @return
     */
    @RequestMapping("/product/skuinfo/info/{skuId}")
    //@RequiresPermissions("product:skuinfo:info")
    public R info(@PathVariable("skuId") Long skuId);
}
