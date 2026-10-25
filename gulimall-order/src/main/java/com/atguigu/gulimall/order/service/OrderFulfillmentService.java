package com.atguigu.gulimall.order.service;

import com.atguigu.common.security.ApiProblem;
import com.atguigu.gulimall.order.dao.OrderDao;
import com.atguigu.gulimall.order.dao.OrderItemDao;
import com.atguigu.gulimall.order.dao.OrderOperateHistoryDao;
import com.atguigu.gulimall.order.entity.*;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import lombok.Data;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

@Service
public class OrderFulfillmentService {
    @Autowired private OrderDao orders;
    @Autowired private OrderItemDao items;
    @Autowired private OrderOperateHistoryDao history;
    @Autowired private JdbcTemplate db;

    public OrderEntity owned(long id,long memberId) {
        OrderEntity order=required(id);
        if(!Long.valueOf(memberId).equals(order.getMemberId())) throw new ApiProblem(403,"不能操作其他会员的订单");
        return order;
    }
    private OrderEntity required(long id) {
        OrderEntity order=orders.selectById(id);
        if(order==null) throw new ApiProblem(404,"订单不存在"); return order;
    }
    private OrderEntity locked(long id) {
        List<Long> found=db.queryForList("SELECT id FROM oms_order WHERE id=? FOR UPDATE",Long.class,id);
        if(found.isEmpty()) throw new ApiProblem(404,"订单不存在"); return required(id);
    }
    @Transactional(readOnly=true)
    public Map<String,Object> detail(long id,Long memberId) {
        OrderEntity order=memberId==null?required(id):owned(id,memberId);
        Map<String,Object> result=new LinkedHashMap<>(); result.put("order",order);
        result.put("items",items.selectList(new QueryWrapper<OrderItemEntity>().eq("order_id",id).orderByAsc("id")));
        result.put("history",history.selectList(new QueryWrapper<OrderOperateHistoryEntity>().eq("order_id",id).orderByAsc("id")));
        return result;
    }
    @Data public static class Shipment {
        private String deliveryCompany,deliverySn;
        public void validate() {
            deliveryCompany=deliveryCompany==null?"":deliveryCompany.trim(); deliverySn=deliverySn==null?"":deliverySn.trim();
            if(deliveryCompany.isEmpty() || deliveryCompany.length()>64 || deliveryCompany.chars().anyMatch(Character::isISOControl) || !deliverySn.matches("[A-Za-z0-9][A-Za-z0-9-]{0,63}")) throw new ApiProblem(400,"请填写物流公司（1–64 字符）和运单号（1–64 位字母、数字或连字符）");
        }
    }
    private void record(long id,int state,String actor,String note) {
        db.update("INSERT INTO oms_order_operate_history(order_id,operate_man,create_time,order_status,note) VALUES(?,?,NOW(),?,?)",id,actor,state,note);
    }
    @Transactional
    public OrderEntity ship(long id,Shipment shipment) {
        shipment.validate(); OrderEntity order=locked(id);
        if(Arrays.asList(2,3).contains(order.getStatus())) {
            if(shipment.deliveryCompany.equals(order.getDeliveryCompany()) && shipment.deliverySn.equals(order.getDeliverySn())) return order;
            throw new ApiProblem(409,"订单已经发货，不能覆盖原物流信息");
        }
        if(!order.isFulfillmentReady()) throw new ApiProblem(409,"仅已支付且库存扣减已确认的正常订单可以发货");
        if(orders.update(null,new UpdateWrapper<OrderEntity>().eq("id",id).eq("status",1).eq("inventory_status",1).isNotNull("payment_trade_no").set("status",2).set("delivery_company",shipment.deliveryCompany).set("delivery_sn",shipment.deliverySn).setSql("delivery_time=NOW(),modify_time=NOW(),failure_reason=NULL"))!=1) throw new ApiProblem(409,"订单状态已变化，请刷新");
        record(id,2,"admin","已发货："+shipment.deliveryCompany+" / "+shipment.deliverySn); return required(id);
    }
    @Transactional
    public OrderEntity receive(long id,long memberId) {
        OrderEntity order=locked(id);
        if(!Long.valueOf(memberId).equals(order.getMemberId())) throw new ApiProblem(403,"不能操作其他会员的订单");
        if(Integer.valueOf(3).equals(order.getStatus())) return order;
        if(orders.update(null,new UpdateWrapper<OrderEntity>().eq("id",id).eq("member_id",memberId).eq("status",2).eq("inventory_status",1).isNotNull("payment_trade_no").set("status",3).set("confirm_status",1).setSql("receive_time=NOW(),modify_time=NOW()"))!=1) throw new ApiProblem(409,"只有本人已发货的正常订单可以确认收货");
        record(id,3,"member","会员确认收货"); return required(id);
    }
}
