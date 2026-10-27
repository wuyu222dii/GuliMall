package com.atguigu.gulimall.ware.service.impl;

import com.atguigu.common.security.ApiProblem;
import com.atguigu.common.utils.PageUtils;
import com.atguigu.gulimall.ware.dao.PurchaseDao;
import com.atguigu.gulimall.ware.entity.*;
import com.atguigu.gulimall.ware.service.*;
import com.atguigu.gulimall.ware.vo.*;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;

@Service("purchaseService")
public class PurchaseServiceImpl extends ServiceImpl<PurchaseDao, PurchaseEntity> implements PurchaseService {
    @Autowired private PurchaseDetailService detailService;
    @Autowired private WareSkuService wareSkuService;

    @Override public PageUtils queryPage(Map<String,Object> params) { return page(params, false); }
    @Override public PageUtils queryPageUnreceive(Map<String,Object> params) { return page(params, true); }
    private PageUtils page(Map<String,Object> params, boolean unreceived) {
        int page = Integer.parseInt((String) params.getOrDefault("page", "1"));
        int limit = Integer.parseInt((String) params.getOrDefault("limit", "20"));
        if (page < 1 || page > 1000000 || limit < 1 || limit > 100) throw new ApiProblem(400, "分页参数不正确");
        QueryWrapper<PurchaseEntity> query = new QueryWrapper<>();
        if (unreceived) query.in("status", 0, 1);
        if (params.get("status") != null && !params.get("status").toString().isEmpty()) {
            int status = Integer.parseInt(params.get("status").toString());
            if (status < 0 || status > 4) throw new ApiProblem(400, "状态不正确");
            query.eq("status", status);
        }
        for (String field : Arrays.asList("wareId", "key")) if (params.get(field) != null && !params.get(field).toString().isEmpty()) {
            long id = Long.parseLong(params.get(field).toString());
            if (id < 1) throw new ApiProblem(400, "查询编号不正确");
            query.eq("wareId".equals(field) ? "ware_id" : "id", id);
        }
        return new PageUtils(page(new Page<PurchaseEntity>(page, limit), query.orderByDesc("id")));
    }
    private PurchaseEntity lock(Long id) {
        if (id == null || id < 1) throw new ApiProblem(400, "采购单编号不正确");
        PurchaseEntity order = getOne(new QueryWrapper<PurchaseEntity>().eq("id", id).last("FOR UPDATE"));
        if (order == null) throw new ApiProblem(404, "采购单不存在");
        return order;
    }
    private List<Long> ids(List<Long> values) {
        if (values == null || values.isEmpty() || values.size() > 100 || values.stream().anyMatch(i -> i == null || i < 1) || new HashSet<>(values).size() != values.size()) throw new ApiProblem(400, "请选择不重复的采购记录，最多 100 项");
        return values.stream().sorted().collect(Collectors.toList());
    }
    private List<PurchaseDetailEntity> lockItems(Long purchaseId) {
        return detailService.list(new QueryWrapper<PurchaseDetailEntity>().eq("purchase_id", purchaseId).orderByAsc("id").last("FOR UPDATE"));
    }
    @Override @Transactional
    public Long mergePurchase(MergeVo request) {
        if (request == null) throw new ApiProblem(400, "合并信息不能为空");
        List<Long> selected = ids(request.getItems());
        PurchaseEntity order = request.getPurchaseId() == null ? null : lock(request.getPurchaseId());
        if (order != null && !Integer.valueOf(0).equals(order.getStatus()) && !Integer.valueOf(1).equals(order.getStatus())) throw new ApiProblem(409, "只能合并到未领取的采购单");
        List<PurchaseDetailEntity> details = detailService.list(new QueryWrapper<PurchaseDetailEntity>().in("id", selected).orderByAsc("id").last("FOR UPDATE"));
        if (details.size() != selected.size()) throw new ApiProblem(404, "采购需求不存在");
        Long warehouse = details.get(0).getWareId();
        for (PurchaseDetailEntity detail : details) {
            if (!Integer.valueOf(0).equals(detail.getStatus()) || detail.getPurchaseId() != null) throw new ApiProblem(409, "需求已分配，不能重复合并");
            if (warehouse == null || !warehouse.equals(detail.getWareId()) || order != null && !warehouse.equals(order.getWareId())) throw new ApiProblem(409, "同一采购单必须属于同一仓库");
            if (detail.getSkuNum() == null || detail.getSkuNum() < 1 || detail.getSkuPrice() == null || detail.getSkuPrice().signum() < 0) throw new ApiProblem(400, "采购需求数据不完整");
        }
        if (order == null) {
            order = new PurchaseEntity(); order.setWareId(warehouse); order.setCreateTime(new Date()); order.setStatus(0); save(order);
        }
        for (PurchaseDetailEntity detail : details) { detail.setPurchaseId(order.getId()); detail.setStatus(1); detailService.updateById(detail); }
        BigDecimal total = detailService.listDetailByPurchaseId(order.getId()).stream().map(PurchaseDetailEntity::getSkuPrice).reduce(BigDecimal.ZERO, BigDecimal::add);
        order.setStatus(1); order.setAmount(total); order.setUpdateTime(new Date()); updateById(order);
        return order.getId();
    }
    @Override @Transactional
    public void received(List<Long> values) {
        for (Long id : ids(values)) {
            PurchaseEntity order = lock(id);
            List<PurchaseDetailEntity> details = lockItems(id);
            if (details.isEmpty()) throw new ApiProblem(409, "采购单没有需求");
            if (Integer.valueOf(2).equals(order.getStatus()) && details.stream().allMatch(d -> Integer.valueOf(2).equals(d.getStatus()))) continue;
            if ((!Integer.valueOf(0).equals(order.getStatus()) && !Integer.valueOf(1).equals(order.getStatus())) || details.stream().anyMatch(d -> !Integer.valueOf(1).equals(d.getStatus()))) throw new ApiProblem(409, "采购单状态不允许领取");
            for (PurchaseDetailEntity detail : details) { detail.setStatus(2); detailService.updateById(detail); }
            order.setStatus(2); order.setUpdateTime(new Date()); updateById(order);
        }
    }
    @Override @Transactional
    public void done(PurchaseDoneVo request) {
        if (request == null || request.getItems() == null || request.getItems().stream().anyMatch(Objects::isNull)) throw new ApiProblem(400, "完成信息不能为空");
        ids(request.getItems().stream().map(PurchaseItemDoneVo::getItemId).collect(Collectors.toList()));
        Map<Long,PurchaseItemDoneVo> results = new HashMap<>();
        for (PurchaseItemDoneVo item : request.getItems()) {
            if (!Integer.valueOf(3).equals(item.getStatus()) && !Integer.valueOf(4).equals(item.getStatus())) throw new ApiProblem(400, "完成结果只能为成功或失败");
            if (Integer.valueOf(4).equals(item.getStatus()) && (item.getReason() == null || item.getReason().trim().isEmpty() || item.getReason().length() > 255)) throw new ApiProblem(400, "失败项须填写 1–255 字的原因");
            item.setReason(Integer.valueOf(4).equals(item.getStatus()) ? item.getReason().trim() : ""); results.put(item.getItemId(), item);
        }
        PurchaseEntity order = lock(request.getId());
        List<PurchaseDetailEntity> details = lockItems(order.getId());
        Set<Long> expected = details.stream().map(PurchaseDetailEntity::getId).collect(Collectors.toSet());
        if (!expected.equals(results.keySet())) throw new ApiProblem(400, "须完整提交此采购单的全部需求，不能混入其他采购单");
        if (Integer.valueOf(3).equals(order.getStatus()) || Integer.valueOf(4).equals(order.getStatus())) {
            if (details.stream().allMatch(d -> Objects.equals(d.getStatus(), results.get(d.getId()).getStatus()) && Objects.equals(d.getFailureReason(), results.get(d.getId()).getReason()))) return;
            throw new ApiProblem(409, "采购单已完成，结果不可更改");
        }
        if (!Integer.valueOf(2).equals(order.getStatus()) || details.stream().anyMatch(d -> !Integer.valueOf(2).equals(d.getStatus()))) throw new ApiProblem(409, "须先领取采购单，再完成入库");
        boolean success = true;
        for (PurchaseDetailEntity detail : details) {
            PurchaseItemDoneVo result = results.get(detail.getId());
            if (Integer.valueOf(3).equals(result.getStatus())) wareSkuService.addStock(detail.getSkuId(), detail.getWareId(), detail.getSkuNum());
            else success = false;
            detail.setStatus(result.getStatus()); detail.setFailureReason(result.getReason()); detailService.updateById(detail);
        }
        order.setStatus(success ? 3 : 4); order.setUpdateTime(new Date()); updateById(order);
    }
}
