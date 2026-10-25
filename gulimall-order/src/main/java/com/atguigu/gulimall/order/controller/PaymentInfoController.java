package com.atguigu.gulimall.order.controller;

import com.atguigu.common.utils.PageUtils;
import com.atguigu.common.utils.R;
import com.atguigu.gulimall.order.entity.PaymentInfoEntity;
import com.atguigu.gulimall.order.service.PaymentInfoService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.Map;



/**
 * Payment info
 *
 * @author liurui
 * @email liurui@gmail.com
 * @date 2023-10-18 15:47:43
 */
@RestController
@RequestMapping("order/paymentinfo")
public class PaymentInfoController {
    @Autowired
    private PaymentInfoService paymentInfoService;

    /**
     * List
     */
    @RequestMapping("/list")
    //@RequiresPermissions("order:paymentinfo:list")
    public R list(@RequestParam Map<String, Object> params){
        PageUtils page = paymentInfoService.queryPage(params);

        return R.ok().put("page", page);
    }


    /**
     * Info
     */
    @RequestMapping("/info/{id}")
    //@RequiresPermissions("order:paymentinfo:info")
    public R info(@PathVariable("id") Long id){
		PaymentInfoEntity paymentInfo = paymentInfoService.getById(id);

        return R.ok().put("paymentInfo", paymentInfo);
    }

    /**
     * Save
     */
    @RequestMapping("/save")
    //@RequiresPermissions("order:paymentinfo:save")
    public R save(@RequestBody PaymentInfoEntity paymentInfo){
		throw new com.atguigu.common.security.ApiProblem(409,"支付流水和订单快照只能通过业务流程变更");
    }

    /**
     * Update
     */
    @RequestMapping("/update")
    //@RequiresPermissions("order:paymentinfo:update")
    public R update(@RequestBody PaymentInfoEntity paymentInfo){
		throw new com.atguigu.common.security.ApiProblem(409,"支付流水和订单快照只能通过业务流程变更");
    }

    /**
     * Delete
     */
    @RequestMapping("/delete")
    //@RequiresPermissions("order:paymentinfo:delete")
    public R delete(@RequestBody Long[] ids){
		throw new com.atguigu.common.security.ApiProblem(409,"支付流水和订单快照只能通过业务流程变更");
    }

}
