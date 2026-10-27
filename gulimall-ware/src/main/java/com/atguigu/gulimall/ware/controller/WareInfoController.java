package com.atguigu.gulimall.ware.controller;

import java.util.Arrays;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.atguigu.gulimall.ware.entity.WareInfoEntity;
import com.atguigu.gulimall.ware.service.WareInfoService;
import com.atguigu.common.utils.PageUtils;
import com.atguigu.common.utils.R;



/**
 * Warehouse info
 *
 * @author liurui
 * @email liurui@gmail.com
 * @date 2023-10-18 15:52:12
 */
@RestController
@RequestMapping("ware/wareinfo")
public class WareInfoController {
    @Autowired
    private WareInfoService wareInfoService;

    /**
     * List
     */
    @RequestMapping("/list")
    //@RequiresPermissions("ware:wareinfo:list")
    public R list(@RequestParam Map<String, Object> params){
        PageUtils page = wareInfoService.queryPage(params);

        return R.ok().put("page", page);
    }


    /**
     * Info
     */
    @RequestMapping("/info/{id}")
    //@RequiresPermissions("ware:wareinfo:info")
    public R info(@PathVariable("id") Long id){
		WareInfoEntity wareInfo = wareInfoService.getById(id);

        return R.ok().put("wareInfo", wareInfo);
    }

    /**
     * Save
     */
    @RequestMapping("/save")
    //@RequiresPermissions("ware:wareinfo:save")
    public R save(@RequestBody WareInfoEntity wareInfo){
        WareInfoEntity value=validated(wareInfo);wareInfoService.save(value);
        return R.ok().put("id",value.getId());
    }

    /**
     * Update
     */
    @RequestMapping("/update")
    //@RequiresPermissions("ware:wareinfo:update")
    public R update(@RequestBody WareInfoEntity wareInfo){
        if(wareInfo==null || wareInfo.getId()==null || wareInfo.getId()<1) throw new com.atguigu.common.security.ApiProblem(400,"请选择仓库");
        if(wareInfoService.getById(wareInfo.getId())==null) throw new com.atguigu.common.security.ApiProblem(404,"仓库不存在");
        WareInfoEntity value=validated(wareInfo);value.setId(wareInfo.getId());wareInfoService.updateById(value);

        return R.ok();
    }
    private WareInfoEntity validated(WareInfoEntity input) {
        if(input==null || input.getName()==null || input.getName().trim().isEmpty() || input.getName().length()>100 || input.getAddress()==null || input.getAddress().trim().isEmpty() || input.getAddress().length()>255 || input.getAreacode()!=null && input.getAreacode().length()>20) throw new com.atguigu.common.security.ApiProblem(400,"仓库名称、地址或区域编码不正确");
        WareInfoEntity value=new WareInfoEntity();value.setName(input.getName().trim());value.setAddress(input.getAddress().trim());value.setAreacode(input.getAreacode()==null?"":input.getAreacode().trim());return value;
    }

    /**
     * Delete
     */
    @RequestMapping("/delete")
    //@RequiresPermissions("ware:wareinfo:delete")
    public R delete(@RequestBody Long[] ids){
        throw new com.atguigu.common.security.ApiProblem(409, "仓库须保留采购和库存引用，本阶段不提供直接删除");
    }

}
