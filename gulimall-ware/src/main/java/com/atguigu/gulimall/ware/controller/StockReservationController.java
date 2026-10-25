package com.atguigu.gulimall.ware.controller;
import com.atguigu.common.to.StockLockTo;
import com.atguigu.common.utils.R;
import com.atguigu.gulimall.ware.service.StockReservationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping("/internal/stock")
public class StockReservationController {
    @Autowired private StockReservationService stock;
    @GetMapping("/{orderSn}") public R status(@PathVariable String orderSn) { return R.ok().put("data",stock.status(orderSn)); }
    @PostMapping("/lock") public R lock(@RequestBody StockLockTo request) { return R.ok().put("data",stock.lock(request)); }
    @PostMapping("/{orderSn}/release") public R release(@PathVariable String orderSn) { return R.ok().put("data",stock.release(orderSn)); }
}
