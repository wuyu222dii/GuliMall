package com.atguigu.gulimall.order.web;

import com.atguigu.gulimall.order.service.OrderService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;
import com.atguigu.common.security.RequestIdentity;
import javax.servlet.http.HttpServletRequest;

@Controller
public class PayWebController {

    @Autowired
    private OrderService orderService;

    @ResponseBody
    @GetMapping(value = "/aliPayOrder",produces = "text/html")
    public String aliPayOrder(@RequestParam("orderSn") String orderSn, HttpServletRequest request) {
        orderService.getOrderPay(orderSn, RequestIdentity.memberId(request));
        throw new com.atguigu.common.security.ApiProblem(405,"请通过受 CSRF 保护的 POST 支付入口发起支付");
    }


}
