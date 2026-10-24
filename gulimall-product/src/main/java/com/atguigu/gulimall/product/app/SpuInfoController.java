package com.atguigu.gulimall.product.app;

import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import com.atguigu.gulimall.product.entity.SpuInfoEntity;
import com.atguigu.gulimall.product.service.SpuInfoService;
import com.atguigu.common.utils.PageUtils;
import com.atguigu.common.utils.R;


/**
 * spuinformation
 *
 * @author liurui
 * @email liurui@gmail.com
 * @date 2023-10-18 13:51:32
 */
@RestController
@RequestMapping("product/spuinfo")
public class SpuInfoController {
    @Autowired
    private SpuInfoService spuInfoService;
    @Autowired private com.atguigu.gulimall.product.service.SearchSyncService searchSync;

    @GetMapping("/editor/{id}")
    public R editor(@PathVariable Long id) { return R.ok().put("product", spuInfoService.getEditor(id)); }

    @PostMapping("/editor")
    public R saveEditor(@RequestBody com.atguigu.gulimall.product.vo.SpuSaveVo product) {
        return R.ok().put("id", spuInfoService.saveSpuInfo(product));
    }

    // /product/spuinfo/{spuId}/up
    @PostMapping("/{spuId}/up")
    public R spuUp(@PathVariable("spuId") Long spuId) {
        spuInfoService.up(spuId);

        return R.ok();
    }

    /**
     * list
     */
    @RequestMapping("/list")
    //@RequiresPermissions("product:spuinfo:list")
    public R list(@RequestParam Map<String, Object> params) {
        PageUtils page = spuInfoService.queryPageByCondition(params);

        return R.ok().put("page", page);
    }


    /**
     * information
     */
    @RequestMapping("/info/{id}")
    //@RequiresPermissions("product:spuinfo:info")
    public R info(@PathVariable("id") Long id) {
        SpuInfoEntity spuInfo = spuInfoService.getById(id);

        return R.ok().put("spuInfo", spuInfo);
    }

    /**
     * save
     */
    @RequestMapping("/save")
    //@RequiresPermissions("product:spuinfo:save")
    public R save(@RequestBody SpuInfoEntity spuInfo) {
        throw new com.atguigu.common.security.ApiProblem(409,"请通过完整商品编辑保存 SPU 与 SKU");
    }

    /**
     * Revise
     */
    @RequestMapping("/update")
    //@RequiresPermissions("product:spuinfo:update")
    public R update(@RequestBody SpuInfoEntity spuInfo) {
        if (spuInfo == null || spuInfo.getId() == null || spuInfo.getPublishStatus() == null) throw new com.atguigu.common.security.ApiProblem(400,"请提供商品编号与上下架状态");
        searchSync.publish(spuInfo.getId(),spuInfo.getPublishStatus());

        return R.ok().put("msg", "上下架目标已保存，搜索同步任务已排队");
    }

    /**
     * delete
     */
    @RequestMapping("/delete")
    //@RequiresPermissions("product:spuinfo:delete")
    public R delete(@RequestBody Long[] ids) {
        throw new com.atguigu.common.security.ApiProblem(409, "商品保留库存和订单引用，不能直接删除，请下架商品");
    }

}
