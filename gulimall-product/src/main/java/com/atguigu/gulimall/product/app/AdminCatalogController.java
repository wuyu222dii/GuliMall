package com.atguigu.gulimall.product.app;

import com.atguigu.common.utils.R;
import com.atguigu.gulimall.product.entity.*;
import com.atguigu.gulimall.product.service.AdminCatalogService;
import com.atguigu.gulimall.product.service.AdminCatalogQuery;
import com.atguigu.gulimall.product.vo.AttrVo;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/product/admin/catalog")
public class AdminCatalogController {
    @Autowired private AdminCatalogService catalog;
    @GetMapping public R metadata() { return R.ok().put("data", catalog.metadata()); }
    @GetMapping("/categories/tree") public R tree() { return R.ok().put("data",catalog.categoryTree()); }
    @GetMapping("/{kind}/page") public R page(@PathVariable String kind,@RequestParam org.springframework.util.MultiValueMap<String,String> params) { return R.ok().put("page",catalog.page(new AdminCatalogQuery(kind,params))); }
    @GetMapping("/{kind}/{id}") public R detail(@PathVariable String kind,@PathVariable Long id) { return R.ok().put("data",catalog.detail(kind,id)); }
    @GetMapping("/{kind}/{id}/position") public R position(@PathVariable String kind,@PathVariable Long id,@RequestParam org.springframework.util.MultiValueMap<String,String> params) { return R.ok().put("data",catalog.position(new AdminCatalogQuery(kind,params),id)); }
    @PostMapping("/categories") public R category(@RequestBody CategoryEntity value) { return R.ok().put("id", catalog.category(value)); }
    @PostMapping("/brands") public R brand(@RequestBody BrandEntity value) { return R.ok().put("id", catalog.brand(value)); }
    @PostMapping("/groups") public R group(@RequestBody AttrGroupEntity value) { return R.ok().put("id", catalog.group(value)); }
    @PostMapping("/attrs") public R attribute(@RequestBody AttrVo value) { return R.ok().put("id", catalog.attribute(value)); }
    @DeleteMapping("/{kind}/{id}") public R delete(@PathVariable String kind, @PathVariable Long id) { catalog.delete(kind, id); return R.ok(); }
}
