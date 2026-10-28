package com.atguigu.gulimall.ware.controller;

import java.util.Arrays;
import java.util.Date;
import java.util.List;
import java.util.Map;

import com.atguigu.gulimall.ware.vo.MergeVo;
import com.atguigu.gulimall.ware.vo.PurchaseDoneVo;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import com.atguigu.gulimall.ware.entity.PurchaseEntity;
import com.atguigu.gulimall.ware.service.PurchaseService;
import com.atguigu.common.utils.PageUtils;
import com.atguigu.common.utils.R;


/**
 * Purchase info
 *
 * @author liurui
 * @email liurui@gmail.com
 * @date 2023-10-18 15:52:12
 */
@RestController
@RequestMapping("ware/purchase")
public class PurchaseController {
    @Autowired
    private PurchaseService purchaseService;
    @Autowired private com.atguigu.gulimall.ware.service.PurchaseDetailService details;

    /**
     * Complete purchase order
     */
    @PostMapping("/done")
    public R finish(@RequestBody PurchaseDoneVo doneVo) {
        purchaseService.done(doneVo);

        return R.ok();
    }


    /**
     * Assign purchase order
     *
     * @param ids
     * @return
     */
    @PostMapping("/received")
    public R received(@RequestBody List<Long> ids) {
        purchaseService.received(ids);
        return R.ok();
    }


    // /ware/purchase/unreceive/list
    // /ware/purchase/merge
    @PostMapping("/merge")
    public R merge(@RequestBody MergeVo mergeVo) {

        return R.ok().put("purchaseId", purchaseService.mergePurchase(mergeVo));
    }

    @RequestMapping("/unreceive/list")
    //@RequiresPermissions("ware:purchase:list")
    public R unreceivelist(@RequestParam org.springframework.util.MultiValueMap<String,String> params) {
        PageUtils page = purchaseService.queryPageUnreceive(com.atguigu.common.utils.Query.singleParameters(params,"key","status","wareId","ware_id"));

        return R.ok().put("page", page);
    }

    /**
     * List
     */
    @RequestMapping("/list")
    //@RequiresPermissions("ware:purchase:list")
    public R list(@RequestParam org.springframework.util.MultiValueMap<String,String> params) {
        PageUtils page = purchaseService.queryPage(com.atguigu.common.utils.Query.singleParameters(params,"key","status","wareId","ware_id"));

        return R.ok().put("page", page);
    }


    /**
     * Info
     */
    @RequestMapping("/info/{id}")
    //@RequiresPermissions("ware:purchase:info")
    public R info(@PathVariable("id") Long id) {
        PurchaseEntity purchase = purchaseService.getById(id);
        if (purchase == null) throw new com.atguigu.common.security.ApiProblem(404, "采购单不存在");
        return R.ok().put("purchase", purchase).put("items", details.listDetailByPurchaseId(id));
    }

    /**
     * Save
     */
    @RequestMapping("/save")
    //@RequiresPermissions("ware:purchase:save")
    public R save(@RequestBody PurchaseEntity purchase) {
        throw new com.atguigu.common.security.ApiProblem(409, "请从采购需求合并创建采购单");
    }

    /**
     * Update
     */
    @RequestMapping("/update")
    //@RequiresPermissions("ware:purchase:update")
    public R update(@RequestBody PurchaseEntity purchase) {
        throw new com.atguigu.common.security.ApiProblem(409, "请使用领取和完成操作变更采购状态");
    }

    /**
     * Delete
     */
    @RequestMapping("/delete")
    //@RequiresPermissions("ware:purchase:delete")
    public R delete(@RequestBody Long[] ids) {
        throw new com.atguigu.common.security.ApiProblem(409, "采购单须保留入库记录，不能直接删除");
    }

}
