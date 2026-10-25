package com.atguigu.gulimall.order.controller;
import com.atguigu.common.security.*;
import com.atguigu.common.utils.R;
import com.atguigu.gulimall.order.service.OrderCreationService;
import com.atguigu.gulimall.order.vo.OrderPlacementInput;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import javax.servlet.http.HttpServletRequest;
@RestController
@RequestMapping("/order/mine")
public class OrderCreationController {
    @Autowired private OrderCreationService orders;
    private long member(HttpServletRequest request) {
        long id=RequestIdentity.memberId(request); String expected=request.getHeader("X-Cart-Owner");
        if(expected!=null && !Long.toString(id).equals(expected)) throw new ApiProblem(409,"会员会话已变化，请刷新身份");
        return id;
    }
    @PostMapping("/confirm") public R confirm(HttpServletRequest request) { return R.ok().put("confirmation",orders.confirm(member(request))); }
    @PostMapping("/submit") public R submit(@RequestBody OrderPlacementInput input,HttpServletRequest request) {
        member(request); if(input==null) throw new ApiProblem(400,"提交参数不能为空");
        return R.ok().put("result",orders.submit(input.getToken(),input.getAddressId(),RequestIdentity.user(request)));
    }
    @GetMapping("/submissions/{token}") public R submission(@PathVariable String token,HttpServletRequest request) { return R.ok().put("result",orders.submission(token,member(request))); }
    @PostMapping("/submissions/{token}/retire") public R retire(@PathVariable String token,HttpServletRequest request) { return R.ok().put("result",orders.retire(token,member(request))); }
    @GetMapping("/by-number/{sn}") public R detail(@PathVariable String sn,HttpServletRequest request) { return R.ok().put("result",orders.detail(sn,member(request))); }
}
