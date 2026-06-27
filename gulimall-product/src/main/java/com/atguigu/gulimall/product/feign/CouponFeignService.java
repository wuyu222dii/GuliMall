package com.atguigu.gulimall.product.feign;

import com.atguigu.common.to.SkuReductionTo;
import com.atguigu.common.to.SpuBoundTo;
import com.atguigu.common.utils.R;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseBody;

@FeignClient("gulimall-coupon")
public interface CouponFeignService {

    /**
     * CouponFeignService.saveSpuBounds(spuBoundTo)
     * 1 @RequestBody Convert this object tojson
     * 2 turn upgulimall-couponservice, give/couponspubounds/saveSend a request,
     * Redirect the previous stepjsonPlace it in the request body and send the request
     * 3 The other party service received the request. Request body reasonjsondata
     * (@RequestBody SpuBoundsEntity spuBounds): Convert the request body tojsonconvert toSpuBoundsEntity;
     * if onlyjsonThe data model is compatible, and both services do not need to use the sameto
     *
     * @param spuBoundTo
     * @return
     */
    @PostMapping("/coupon/spubounds/save")
    R saveSpuBounds(@RequestBody SpuBoundTo spuBoundTo);

    @PostMapping("coupon/skufullreduction/saveinfo")
    R saveSkuReduction(@RequestBody SkuReductionTo skuReductionTo);
}
