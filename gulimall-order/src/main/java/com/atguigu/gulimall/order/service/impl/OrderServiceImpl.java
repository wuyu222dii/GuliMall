package com.atguigu.gulimall.order.service.impl;

import com.atguigu.common.utils.PageUtils;
import com.atguigu.gulimall.order.dao.OrderDao;
import com.atguigu.gulimall.order.entity.OrderEntity;
import com.atguigu.gulimall.order.entity.OrderItemEntity;
import com.atguigu.gulimall.order.service.OrderItemService;
import com.atguigu.gulimall.order.service.OrderService;
import com.atguigu.gulimall.order.vo.OrderConfirmVo;
import com.atguigu.gulimall.order.vo.OrderSubmitVo;
import com.atguigu.gulimall.order.vo.PayVo;
import com.atguigu.gulimall.order.vo.SubmitOrderResponseVo;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import com.atguigu.common.security.ApiProblem;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;


@Service("orderService")
public class OrderServiceImpl extends ServiceImpl<OrderDao, OrderEntity> implements OrderService {

    @Autowired
    private OrderItemService orderItemService;

    @Override
    public PageUtils queryPage(Map<String, Object> params) {
        QueryWrapper<OrderEntity> filter=new QueryWrapper<>();
        String sn=String.valueOf(params.getOrDefault("orderSn", "")).trim();
        if(!sn.isEmpty()) {
            if(!sn.matches("[a-f0-9]{32}")) throw new ApiProblem(400,"请填写完整的 32 位订单号");
            filter.eq("order_sn",sn);
        }
        String status=String.valueOf(params.getOrDefault("status", ""));
        if(!status.isEmpty()) {
            if(!status.matches("[0-9]")) throw new ApiProblem(400,"订单状态不正确");
            filter.eq("status",Integer.parseInt(status));
        }
        return new PageUtils(this.page(pagination(params),filter.orderByDesc("id")));
    }
    private IPage<OrderEntity> pagination(Map<String,Object> params) {
        try {
            long page=Long.parseLong(String.valueOf(params.getOrDefault("page","1"))),limit=Long.parseLong(String.valueOf(params.getOrDefault("limit","10")));
            if(page<1 || page>1000000 || limit<1 || limit>100) throw new NumberFormatException();
            return new Page<>(page,limit);
        } catch(NumberFormatException invalid) { throw new ApiProblem(400,"分页参数不正确"); }
    }

    @Override
    public OrderConfirmVo confirmOrder() {
        return new OrderConfirmVo();
    }

    @Override
    public SubmitOrderResponseVo submitOrder(OrderSubmitVo vo) {
        SubmitOrderResponseVo response = new SubmitOrderResponseVo();
        response.setCode(1);
        return response;
    }

    @Override
    public PayVo getOrderPay(String orderSn, Long memberId) {
        OrderEntity order = this.getOne(new QueryWrapper<OrderEntity>().eq("order_sn", orderSn));
        if (order == null) {
            throw new ApiProblem(404, "订单不存在");
        }
        if (!memberId.equals(order.getMemberId())) { throw new ApiProblem(403, "不能支付其他会员的订单"); }
        PayVo payVo = new PayVo();
        payVo.setOut_trade_no(order.getOrderSn());
        payVo.setTotal_amount(order.getPayAmount().setScale(2, BigDecimal.ROUND_UP).toString());
        List<OrderItemEntity> items = orderItemService.list(
                new QueryWrapper<OrderItemEntity>().eq("order_sn", orderSn));
        if (!CollectionUtils.isEmpty(items)) {
            OrderItemEntity item = items.get(0);
            payVo.setSubject(item.getSkuName());
            payVo.setBody(item.getSkuAttrsVals());
        } else {
            payVo.setSubject("Gulimall Order");
        }
        return payVo;
    }

    @Override
    public PageUtils getMemberOrderPage(Map<String, Object> params, Long memberId) {
        return new PageUtils(this.page(pagination(params),
                new QueryWrapper<OrderEntity>().eq("member_id", memberId).orderByDesc("id")));
    }

}
