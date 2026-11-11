package com.atguigu.gulimall.order.controller;

import com.atguigu.common.security.*;
import com.atguigu.common.utils.R;
import com.atguigu.gulimall.order.entity.OrderEntity;
import com.atguigu.gulimall.order.service.OrderService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import javax.servlet.http.HttpServletRequest;
import java.util.Map;

@RestController
@RequestMapping("/order/mine")
public class MemberOrderController {
    @Autowired private OrderService orders;
    @Autowired private com.atguigu.gulimall.order.service.OrderFulfillmentService fulfillment;
    @Autowired private com.atguigu.gulimall.order.service.PaymentSettlementService payments;
    private long member(HttpServletRequest request) {
        long id=RequestIdentity.memberId(request); String expected=request.getHeader("X-Cart-Owner");
        if(expected!=null && !Long.toString(id).equals(expected)) throw new ApiProblem(409,"会员会话已变化，请刷新"); return id;
    }
    @GetMapping
    public R list(@RequestParam org.springframework.util.MultiValueMap<String,String> query, HttpServletRequest request) {
        if(query.containsKey("sidx") || query.containsKey("order")) throw new ApiProblem(400,"订单查询不支持排序参数");
        Map<String,Object> params=com.atguigu.common.utils.Query.singleParameters(query,"status","orderSn");
        if(params.containsKey("page") && !String.valueOf(params.get("page")).matches("[1-9][0-9]{0,6}")) throw new ApiProblem(400,"页码不正确");
        return R.ok().put("page", orders.getMemberOrderPage(params, member(request)));
    }
    @GetMapping("/{id}")
    public R detail(@PathVariable Long id, HttpServletRequest request) {
        R result=R.ok(); result.putAll(fulfillment.detail(id,member(request))); return result;
    }
    @PostMapping("/{id}/receive") public R receive(@PathVariable long id,HttpServletRequest request) { return R.ok().put("order",fulfillment.receive(id,member(request))); }
    @PostMapping("/{id}/cancel") public R cancel(@PathVariable long id,HttpServletRequest request) {
        long memberId=member(request); OrderEntity order=fulfillment.owned(id,memberId);
        return R.ok().put("order",payments.cancel(order.getOrderSn(),memberId));
    }
}
