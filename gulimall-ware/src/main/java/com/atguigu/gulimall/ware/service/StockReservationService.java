package com.atguigu.gulimall.ware.service;
import com.alibaba.fastjson.JSON;
import com.atguigu.common.security.ApiProblem;
import com.atguigu.common.to.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

@Service
public class StockReservationService {
    @Autowired private JdbcTemplate db;
    public static void number(String orderSn) {
        if(orderSn==null || !orderSn.matches("[a-f0-9]{32}")) throw new ApiProblem(400,"订单号不正确");
    }
    public static String payload(StockLockTo request) {
        if(request==null) throw new ApiProblem(400,"锁库请求不能为空"); number(request.getOrderSn());
        if(request.getItems()==null || request.getItems().isEmpty() || request.getItems().size()>100) throw new ApiProblem(400,"商品数量不正确");
        Map<Long,Integer> normalized=new TreeMap<>();
        for(OrderLineTo line:request.getItems()) {
            if(line==null || line.getSkuId()==null || line.getSkuId()<1 || line.getCount()==null || line.getCount()<1 || line.getCount()>999 || normalized.put(line.getSkuId(),line.getCount())!=null) throw new ApiProblem(400,"锁库商品或数量不正确");
        }
        return JSON.toJSONString(normalized);
    }
    public Map<String,Object> status(String orderSn) {
        number(orderSn);
        List<Map<String,Object>> tasks=db.queryForList("SELECT id,task_status FROM wms_ware_order_task WHERE order_sn=?",orderSn);
        Map<String,Object> result=new LinkedHashMap<>();
        result.put("state",tasks.isEmpty()?"ABSENT":state(((Number)tasks.get(0).get("task_status")).intValue()));
        if(!tasks.isEmpty()) result.put("details",db.queryForList("SELECT sku_id,sku_num,ware_id,lock_status FROM wms_ware_order_task_detail WHERE task_id=? ORDER BY sku_id",tasks.get(0).get("id")));
        return result;
    }
    private String state(int status) { if(status==1) return "LOCKED"; if(status==2) return "RELEASED"; if(status==3) return "DEDUCTED"; throw new ApiProblem(503,"库存工作单状态异常，请人工检查"); }
    @Transactional public Map<String,Object> lock(StockLockTo request) {
        String payload=payload(request), sn=request.getOrderSn();
        db.update("INSERT INTO wms_ware_order_task(order_sn,task_status,lock_payload,create_time) VALUES(?,0,?,NOW()) ON DUPLICATE KEY UPDATE id=id",sn,payload);
        Map<String,Object> task=db.queryForMap("SELECT * FROM wms_ware_order_task WHERE order_sn=? FOR UPDATE",sn);
        int status=((Number)task.get("task_status")).intValue();
        if(status==2) return status(sn); // The release fence also rejects a lock arriving after closure.
        if(!payload.equals(task.get("lock_payload"))) throw new ApiProblem(409,"同一订单不能更改锁库内容");
        if(status==1 || status==3) return status(sn);
        List<OrderLineTo> lines=new ArrayList<>(request.getItems()); lines.sort(Comparator.comparing(OrderLineTo::getSkuId));
        for(OrderLineTo line:lines) {
            List<Map<String,Object>> candidates=db.queryForList("SELECT id,ware_id FROM wms_ware_sku WHERE sku_id=? AND stock-stock_locked>=? ORDER BY ware_id",line.getSkuId(),line.getCount());
            boolean locked=false;
            for(Map<String,Object> warehouse:candidates) {
                if(db.update("UPDATE wms_ware_sku SET stock_locked=stock_locked+? WHERE id=? AND stock-stock_locked>=?",line.getCount(),warehouse.get("id"),line.getCount())==1) {
                    db.update("INSERT INTO wms_ware_order_task_detail(sku_id,sku_num,task_id,ware_id,lock_status) VALUES(?,?,?,?,1)",line.getSkuId(),line.getCount(),task.get("id"),warehouse.get("ware_id"));
                    locked=true; break;
                }
            }
            if(!locked) throw new ApiProblem(409,"库存不足，所有商品均未锁定");
        }
        db.update("UPDATE wms_ware_order_task SET task_status=1 WHERE id=?",task.get("id"));
        return status(sn);
    }
    @Transactional public Map<String,Object> release(String orderSn) {
        number(orderSn);
        // Persist a fence even if lock has not arrived; late requests cannot acquire stock again.
        db.update("INSERT INTO wms_ware_order_task(order_sn,task_status,create_time) VALUES(?,2,NOW()) ON DUPLICATE KEY UPDATE id=id",orderSn);
        Map<String,Object> task=db.queryForMap("SELECT id,task_status FROM wms_ware_order_task WHERE order_sn=? FOR UPDATE",orderSn);
        int state=((Number)task.get("task_status")).intValue();
        if(state==2) return status(orderSn);
        if(state==3) throw new ApiProblem(409,"已扣减库存不能通过释放接口恢复");
        if(state!=1) throw new ApiProblem(503,"库存工作单状态异常，释放待重试");
        List<Map<String,Object>> lines=db.queryForList("SELECT * FROM wms_ware_order_task_detail WHERE task_id=? AND lock_status=1 ORDER BY sku_id,ware_id FOR UPDATE",task.get("id"));
        for(Map<String,Object> line:lines) {
            int changed=db.update("UPDATE wms_ware_sku SET stock_locked=stock_locked-? WHERE sku_id=? AND ware_id=? AND stock_locked>=?",line.get("sku_num"),line.get("sku_id"),line.get("ware_id"),line.get("sku_num"));
            if(changed!=1) throw new ApiProblem(503,"库存锁定记录不一致，需人工检查");
        }
        db.update("UPDATE wms_ware_order_task_detail SET lock_status=2 WHERE task_id=? AND lock_status=1",task.get("id"));
        db.update("UPDATE wms_ware_order_task SET task_status=2 WHERE id=?",task.get("id"));
        return status(orderSn);
    }
    @Transactional public Map<String,Object> deduct(String orderSn) {
        number(orderSn);
        List<Map<String,Object>> tasks=db.queryForList("SELECT id,task_status FROM wms_ware_order_task WHERE order_sn=? FOR UPDATE",orderSn);
        if(tasks.isEmpty()) throw new ApiProblem(409,"缺少库存工作单，禁止直接扣减");
        Map<String,Object> task=tasks.get(0); int state=((Number)task.get("task_status")).intValue();
        if(state==3) return status(orderSn);
        if(state!=1) throw new ApiProblem(409,"库存已释放，禁止扣减");
        List<Map<String,Object>> lines=db.queryForList("SELECT * FROM wms_ware_order_task_detail WHERE task_id=? AND lock_status=1 ORDER BY sku_id,ware_id FOR UPDATE",task.get("id"));
        if(lines.isEmpty()) throw new ApiProblem(409,"库存锁定明细不存在");
        for(Map<String,Object> line:lines) {
            if(db.update("UPDATE wms_ware_sku SET stock=stock-?,stock_locked=stock_locked-? WHERE sku_id=? AND ware_id=? AND stock>=? AND stock_locked>=?",line.get("sku_num"),line.get("sku_num"),line.get("sku_id"),line.get("ware_id"),line.get("sku_num"),line.get("sku_num"))!=1) throw new ApiProblem(409,"库存记录不一致，禁止扣减并需人工检查");
        }
        db.update("UPDATE wms_ware_order_task_detail SET lock_status=3 WHERE task_id=? AND lock_status=1",task.get("id"));
        db.update("UPDATE wms_ware_order_task SET task_status=3 WHERE id=?",task.get("id")); return status(orderSn);
    }
}
