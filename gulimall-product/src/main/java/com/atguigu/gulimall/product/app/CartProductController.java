package com.atguigu.gulimall.product.app;

import com.atguigu.common.utils.R;
import com.atguigu.gulimall.product.service.SkuInfoService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
public class CartProductController {
    @Autowired private SkuInfoService products;
    @PostMapping("/internal/product/cart-items")
    public R items(@RequestBody List<Long> ids,@RequestParam(defaultValue="true") boolean inventory) { return R.ok().put("data", products.cartProducts(ids,inventory)); }
}
