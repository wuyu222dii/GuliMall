package com.atguigu.gulimall.ware.controller;

import java.util.Arrays;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.atguigu.gulimall.ware.entity.PurchaseDetailEntity;
import com.atguigu.gulimall.ware.service.PurchaseDetailService;
import com.atguigu.common.utils.PageUtils;
import com.atguigu.common.utils.R;



/**
 * 
 *
 * @author liurui
 * @email liurui@gmail.com
 * @date 2023-10-18 15:52:12
 */
@RestController
@RequestMapping("ware/purchasedetail")
public class PurchaseDetailController {
    @Autowired
    private PurchaseDetailService purchaseDetailService;

    /**
     * List
     */
    @RequestMapping("/list")
    //@RequiresPermissions("ware:purchasedetail:list")
    public R list(@RequestParam Map<String, Object> params){
        PageUtils page = purchaseDetailService.queryPage(params);

        return R.ok().put("page", page);
    }


    /**
     * Info
     */
    @RequestMapping("/info/{id}")
    //@RequiresPermissions("ware:purchasedetail:info")
    public R info(@PathVariable("id") Long id){
        if (id == null || id < 1) throw new com.atguigu.common.security.ApiProblem(400, "需求编号不正确");
		PurchaseDetailEntity purchaseDetail = purchaseDetailService.getById(id);
        if (purchaseDetail == null) throw new com.atguigu.common.security.ApiProblem(404, "需求不存在");

        return R.ok().put("purchaseDetail", purchaseDetail);
    }

    /**
     * Save
     */
    @RequestMapping("/save")
    //@RequiresPermissions("ware:purchasedetail:save")
    public R save(@RequestBody PurchaseDetailEntity purchaseDetail){
        return R.ok().put("id", purchaseDetailService.saveDemand(purchaseDetail));
    }

    /**
     * Update
     */
    @RequestMapping("/update")
    //@RequiresPermissions("ware:purchasedetail:update")
    public R update(@RequestBody PurchaseDetailEntity purchaseDetail){
        if (purchaseDetail == null || purchaseDetail.getId() == null) throw new com.atguigu.common.security.ApiProblem(400, "需求编号不能为空");
        return R.ok().put("id", purchaseDetailService.saveDemand(purchaseDetail));
    }

    /**
     * Delete
     */
    @RequestMapping("/delete")
    //@RequiresPermissions("ware:purchasedetail:delete")
    public R delete(@RequestBody Long[] ids){
        if (ids == null) throw new com.atguigu.common.security.ApiProblem(400, "需求编号不能为空");
        purchaseDetailService.deleteDemands(Arrays.asList(ids));

        return R.ok();
    }

}
