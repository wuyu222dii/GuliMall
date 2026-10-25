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
    @Autowired private com.atguigu.gulimall.order.service.OrderCreationService creation;
    @GetMapping
    public R list(@RequestParam Map<String,Object> params, HttpServletRequest request) {
        int page = Integer.parseInt((String) params.getOrDefault("page", "1"));
        int limit = Integer.parseInt((String) params.getOrDefault("limit", "10"));
        if (page < 1 || limit < 1 || limit > 100) { throw new ApiProblem(400, "分页参数不正确"); }
        return R.ok().put("page", orders.getMemberOrderPage(params, RequestIdentity.memberId(request)));
    }
    @GetMapping("/{id}")
    public R detail(@PathVariable Long id, HttpServletRequest request) {
        long memberId = RequestIdentity.memberId(request);
        OrderEntity order = orders.getById(id);
        if (order == null) { throw new ApiProblem(404, "订单不存在"); }
        if (!Long.valueOf(memberId).equals(order.getMemberId())) { throw new ApiProblem(403, "不能访问其他会员的订单"); }
        return R.ok().put("order", order).put("items",creation.detail(order.getOrderSn(),memberId).get("items"));
    }
}
