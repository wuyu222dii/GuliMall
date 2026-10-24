package com.atguigu.gulimall.product.web;

import com.atguigu.common.security.ApiProblem;
import com.atguigu.common.utils.R;
import com.atguigu.gulimall.product.entity.BrandEntity;
import com.atguigu.gulimall.product.service.*;
import com.atguigu.gulimall.product.vo.SkuItemVo;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/product")
public class CatalogController {
    @Autowired private SkuInfoService skus;
    @Autowired private CategoryService categories;
    @Autowired private BrandService brands;

    @GetMapping("/items")
    public R list(@RequestParam Map<String, Object> params) {
        return R.ok().put("page", skus.querySalePage(params));
    }
    @GetMapping("/items/{skuId}")
    public R detail(@PathVariable Long skuId) throws Exception {
        if (skuId < 1) { throw new ApiProblem(400, "商品编号不正确"); }
        return R.ok().put("item", skus.item(skuId));
    }
    @GetMapping("/items/{skuId}/purchase-check")
    public R purchaseCheck(@PathVariable Long skuId) throws Exception {
        if (skuId < 1) { throw new ApiProblem(400, "商品编号不正确"); }
        SkuItemVo item = skus.item(skuId);
        if (!item.isOnSale()) { throw new ApiProblem(409, "商品已下架，不能购买"); }
        if (item.getInfo().getPrice() == null || item.getInfo().getPrice().signum() < 0) { throw new ApiProblem(409, "商品价格暂时不可用"); }
        if (item.getHasStock() == null) { throw new ApiProblem(503, "库存暂时无法确认，请稍后重试"); }
        if (!item.getHasStock()) { throw new ApiProblem(409, "商品缺货，不能购买"); }
        return R.ok().put("skuInfo", item.getInfo());
    }
    @GetMapping("/categories")
    public R categories() { return R.ok().put("data", categories.listWithTree()); }

    @GetMapping("/brands")
    public R brands(@RequestParam(required = false) Long catalogId) {
        if (catalogId != null && catalogId < 0) { throw new ApiProblem(400, "分类编号不正确"); }
        String subquery = "SELECT DISTINCT brand_id FROM pms_spu_info WHERE publish_status = 1";
        if (catalogId != null && catalogId != 0) { subquery += " AND catalog_id = " + catalogId; }
        return R.ok().put("data", brands.list(new QueryWrapper<BrandEntity>().select("brand_id", "name", "logo")
                .eq("show_status", 1).inSql("brand_id", subquery).orderByAsc("sort", "brand_id")));
    }
}
