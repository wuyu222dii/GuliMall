package com.atguigu.gulimall.order.controller;

import com.atguigu.common.utils.PageUtils;
import com.atguigu.common.utils.R;
import com.atguigu.gulimall.order.entity.OrderOperateHistoryEntity;
import com.atguigu.gulimall.order.service.OrderOperateHistoryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.Map;



/**
 * Order operation history
 *
 * @author liurui
 * @email liurui@gmail.com
 * @date 2023-10-18 15:47:43
 */
@RestController
@RequestMapping("order/orderoperatehistory")
public class OrderOperateHistoryController {
    @Autowired
    private OrderOperateHistoryService orderOperateHistoryService;

    /**
     * List
     */
    @RequestMapping("/list")
    //@RequiresPermissions("order:orderoperatehistory:list")
    public R list(@RequestParam Map<String, Object> params){
        PageUtils page = orderOperateHistoryService.queryPage(params);

        return R.ok().put("page", page);
    }


    /**
     * Info
     */
    @RequestMapping("/info/{id}")
    //@RequiresPermissions("order:orderoperatehistory:info")
    public R info(@PathVariable("id") Long id){
		OrderOperateHistoryEntity orderOperateHistory = orderOperateHistoryService.getById(id);

        return R.ok().put("orderOperateHistory", orderOperateHistory);
    }

    /**
     * Save
     */
    @RequestMapping("/save")
    //@RequiresPermissions("order:orderoperatehistory:save")
    public R save(@RequestBody OrderOperateHistoryEntity orderOperateHistory){
        throw new com.atguigu.common.security.ApiProblem(409,"订单历史由业务流程记录，不能直接修改");
    }

    /**
     * Update
     */
    @RequestMapping("/update")
    //@RequiresPermissions("order:orderoperatehistory:update")
    public R update(@RequestBody OrderOperateHistoryEntity orderOperateHistory){
        throw new com.atguigu.common.security.ApiProblem(409,"订单历史由业务流程记录，不能直接修改");
    }

    /**
     * Delete
     */
    @RequestMapping("/delete")
    //@RequiresPermissions("order:orderoperatehistory:delete")
    public R delete(@RequestBody Long[] ids){
        throw new com.atguigu.common.security.ApiProblem(409,"订单历史由业务流程记录，不能直接删除");
    }

}
