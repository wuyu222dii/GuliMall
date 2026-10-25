package com.atguigu.gulimall.order.controller;

import com.atguigu.common.utils.PageUtils;
import com.atguigu.common.utils.R;
import com.atguigu.gulimall.order.entity.OrderEntity;
import com.atguigu.gulimall.order.service.OrderService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.Map;



/**
 * Order
 *
 * @author liurui
 * @email liurui@gmail.com
 * @date 2023-10-18 15:47:43
 */
@RestController
@RequestMapping("order/order")
public class OrderController {
    @Autowired
    private OrderService orderService;
    @Autowired private com.atguigu.gulimall.order.config.AlipayTemplate alipay;

    /**
     * List
     */
    @RequestMapping("/list")
    //@RequiresPermissions("order:order:list")
    public R list(@RequestParam Map<String, Object> params){
        PageUtils page = orderService.queryPage(params);

        return R.ok().put("page", page).put("mode",alipay.localTest()?"LOCAL_TEST":"ALIPAY_SANDBOX");
    }


    /**
     * Info
     */
    @RequestMapping("/info/{id}")
    //@RequiresPermissions("order:order:info")
    public R info(@PathVariable("id") Long id){
		OrderEntity order = orderService.getById(id);

        return R.ok().put("order", order);
    }

    /**
     * Save
     */
    @RequestMapping("/save")
    //@RequiresPermissions("order:order:save")
    public R save(@RequestBody OrderEntity order){
        throw new com.atguigu.common.security.ApiProblem(409,"订单必须通过下单业务创建");
    }

    /**
     * Update
     */
    @RequestMapping("/update")
    //@RequiresPermissions("order:order:update")
    public R update(@RequestBody OrderEntity order){
        throw new com.atguigu.common.security.ApiProblem(409,"订单状态必须通过业务流程变更");
    }

    /**
     * Delete
     */
    @RequestMapping("/delete")
    //@RequiresPermissions("order:order:delete")
    public R delete(@RequestBody Long[] ids){
        throw new com.atguigu.common.security.ApiProblem(409,"订单不能直接删除，需先完成业务关闭");
    }

}
