package com.atguigu.gulimall.cart.controller;
import com.atguigu.common.to.StockLockTo;
import com.atguigu.common.utils.R;
import com.atguigu.gulimall.cart.service.CartService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping("/internal/cart/{memberId}")
public class OrderCartController {
    @Autowired private CartService cart;
    @GetMapping("/selected") public R selected(@PathVariable long memberId) { return R.ok().put("data",cart.view(memberId,true).getItems()); }
    @PostMapping("/ordered") public R ordered(@PathVariable long memberId,@RequestBody StockLockTo request) { cart.ordered(memberId,request); return R.ok(); }
}
