package com.atguigu.gulimall.order.controller;
import com.atguigu.common.security.*;
import com.atguigu.common.utils.R;
import com.atguigu.gulimall.order.service.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import javax.servlet.http.HttpServletRequest;
import java.util.*;
@RestController
public class PaymentController {
    @Autowired private PaymentSettlementService payments;
    @Autowired private TradeEventService events;
    private long member(HttpServletRequest request) {
        long id=RequestIdentity.memberId(request); String expected=request.getHeader("X-Cart-Owner");
        if(expected!=null && !Long.toString(id).equals(expected)) throw new ApiProblem(409,"会员会话已变化，请刷新"); return id;
    }
    @PostMapping("/order/mine/{sn}/payment") public R form(@PathVariable String sn,HttpServletRequest request) { return R.ok().put("payment",payments.form(sn,member(request))); }
    @GetMapping("/order/mine/{sn}/payment-status") public R status(@PathVariable String sn,HttpServletRequest request) { return R.ok().put("payment",payments.status(sn,member(request))); }
    @PostMapping(value="/payments/alipay/notify",consumes="application/x-www-form-urlencoded",produces="text/plain;charset=UTF-8") public String notify(HttpServletRequest request) {
        Map<String,String> params=new HashMap<>();
        if(request.getParameterMap().size()>100) throw new ApiProblem(400,"支付通知字段过多");
        for(Map.Entry<String,String[]> entry:request.getParameterMap().entrySet()) {
            if(entry.getValue().length!=1 || entry.getValue()[0].length()>16384) throw new ApiProblem(400,"支付通知字段不正确"); params.put(entry.getKey(),entry.getValue()[0]);
        }
        payments.notify(params); return "success";
    }
    @GetMapping("/internal/order/events/{id}") public R event(@PathVariable long id) { return R.ok().put("data",events.descriptor(id)); }
    @PostMapping("/internal/order/events/{id}/complete") public R complete(@PathVariable long id,@RequestBody Map<String,String> body) { events.completed(id,body.get("state")); return R.ok(); }
    @PostMapping("/order/payments/{sn}/retry") public R retry(@PathVariable String sn) { payments.reconcile(sn); return R.ok().put("queued",events.retry(sn)); }
}
