package com.atguigu.gulimall.ware.feign;

import com.atguigu.common.utils.R;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;

@FeignClient("gulimall-product")
public interface ProductFeignService {

    /**
     *
     * 1）、让所有请求过网关：
     *        1、@FeignClient("gulimall-gateway")：给gulimall-gateway所在机器发送请求
     *        2、"/api/product/skuinfo/info/{skuId}"
     * 2）、直接让后台指定服务器处理
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
