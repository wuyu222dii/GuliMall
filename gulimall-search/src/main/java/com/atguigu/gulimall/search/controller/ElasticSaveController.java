package com.atguigu.gulimall.search.controller;
import com.atguigu.common.to.SearchSyncRequest;
import com.atguigu.common.utils.R;
import com.atguigu.gulimall.search.service.ProductSaveService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping("/internal/search")
public class ElasticSaveController {
    @Autowired private ProductSaveService products;
    @PostMapping("/synchronize") public R synchronize(@RequestBody SearchSyncRequest request) { products.synchronize(request); return R.ok(); }
    @PostMapping("/index") public R index() { products.ensureIndex(); return R.ok(); }
}
