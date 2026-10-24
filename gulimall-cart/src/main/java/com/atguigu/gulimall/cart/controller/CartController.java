package com.atguigu.gulimall.cart.controller;
import com.atguigu.common.security.RequestIdentity;
import com.atguigu.common.utils.R;
import com.atguigu.gulimall.cart.service.CartService;
import com.atguigu.gulimall.cart.vo.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import javax.servlet.http.HttpServletRequest;
@RestController
@RequestMapping("/cart")
public class CartController {
    @Autowired private CartService cart;
    private long member(HttpServletRequest request) {
        long id = RequestIdentity.memberId(request);
        String expected = request.getHeader("X-Cart-Owner");
        if (expected != null && !Long.toString(id).equals(expected)) throw new com.atguigu.common.security.ApiProblem(409,"会员会话已变化，请刷新身份后再操作购物车");
        return id;
    }
    @GetMapping public R list(HttpServletRequest request) { return R.ok().put("cart",cart.view(member(request),false)); }
    @GetMapping("/selected") public R selected(HttpServletRequest request) { return R.ok().put("cart",cart.view(member(request),true)); }
    @PostMapping("/items") public R add(@RequestBody CartInput item,HttpServletRequest request) { cart.add(member(request),item); return R.ok(); }
    @PutMapping("/items/count") public R count(@RequestBody CartInput item,HttpServletRequest request) { cart.count(member(request),item); return R.ok(); }
    @PutMapping("/items/checked") public R checked(@RequestBody CartInput item,HttpServletRequest request) { cart.check(member(request),item); return R.ok(); }
    @DeleteMapping("/items/{skuId}") public R remove(@PathVariable Long skuId,HttpServletRequest request) { cart.remove(member(request),skuId); return R.ok(); }
    @DeleteMapping public R clear(HttpServletRequest request) { cart.clear(member(request)); return R.ok(); }
    @PostMapping("/merge") public R merge(@RequestBody CartMerge body,HttpServletRequest request) { return R.ok().put("replayed",cart.merge(member(request),body)); }
}
