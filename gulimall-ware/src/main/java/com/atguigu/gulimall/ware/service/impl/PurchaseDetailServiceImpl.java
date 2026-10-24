package com.atguigu.gulimall.ware.service.impl;

import com.baomidou.mybatisplus.core.toolkit.StringUtils;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.atguigu.common.utils.PageUtils;
import com.atguigu.common.utils.Query;

import com.atguigu.gulimall.ware.dao.PurchaseDetailDao;
import com.atguigu.gulimall.ware.entity.PurchaseDetailEntity;
import com.atguigu.gulimall.ware.service.PurchaseDetailService;


@Service("purchaseDetailService")
public class PurchaseDetailServiceImpl extends ServiceImpl<PurchaseDetailDao, PurchaseDetailEntity> implements PurchaseDetailService {
    @org.springframework.beans.factory.annotation.Autowired private com.atguigu.gulimall.ware.service.WareInfoService warehouses;
    @org.springframework.beans.factory.annotation.Autowired private com.atguigu.gulimall.ware.feign.ProductFeignService products;

    @Override
    @org.springframework.transaction.annotation.Transactional
    public Long saveDemand(PurchaseDetailEntity request) {
        if (request == null || request.getSkuId() == null || request.getSkuId() < 1 || request.getWareId() == null || request.getWareId() < 1
                || request.getSkuNum() == null || request.getSkuNum() < 1 || request.getSkuNum() > 1000000 || request.getSkuPrice() == null
                || request.getSkuPrice().signum() < 0 || request.getSkuPrice().scale() > 2 || request.getSkuPrice().compareTo(new java.math.BigDecimal("999999999999.99")) > 0)
            throw new com.atguigu.common.security.ApiProblem(400, "采购需求数量或金额不正确");
        if (request.getPurchaseId() != null || request.getStatus() != null && request.getStatus() != 0) throw new com.atguigu.common.security.ApiProblem(400, "采购状态只能由业务操作变更");
        if (warehouses.getById(request.getWareId()) == null) throw new com.atguigu.common.security.ApiProblem(400, "仓库不存在");
        com.atguigu.common.utils.R product;
        try { product = products.info(request.getSkuId()); }
        catch (Exception unavailable) { throw new com.atguigu.common.security.ApiProblem(503, "商品服务暂不可用，请稍后重试"); }
        if (product.getCode() != 0 || product.get("skuInfo") == null) throw new com.atguigu.common.security.ApiProblem(400, "SKU 不存在");
        if (request.getId() != null) {
            PurchaseDetailEntity old = getOne(new QueryWrapper<PurchaseDetailEntity>().eq("id", request.getId()).last("FOR UPDATE"));
            if (old == null) throw new com.atguigu.common.security.ApiProblem(404, "需求不存在");
            if (!Integer.valueOf(0).equals(old.getStatus()) || old.getPurchaseId() != null) throw new com.atguigu.common.security.ApiProblem(409, "已分配需求不能修改");
        }
        PurchaseDetailEntity value = new PurchaseDetailEntity(); value.setId(request.getId()); value.setSkuId(request.getSkuId()); value.setSkuNum(request.getSkuNum());
        value.setWareId(request.getWareId()); value.setSkuPrice(request.getSkuPrice()); value.setStatus(0); saveOrUpdate(value); return value.getId();
    }

    @Override
    @org.springframework.transaction.annotation.Transactional
    public void deleteDemands(List<Long> ids) {
        if (ids == null || ids.isEmpty() || ids.size() > 100 || ids.contains(null) || new java.util.HashSet<>(ids).size() != ids.size()) throw new com.atguigu.common.security.ApiProblem(400, "需求编号不正确");
        List<PurchaseDetailEntity> details = list(new QueryWrapper<PurchaseDetailEntity>().in("id", ids).orderByAsc("id").last("FOR UPDATE"));
        if (details.size() != ids.size()) throw new com.atguigu.common.security.ApiProblem(404, "需求不存在");
        if (details.stream().anyMatch(d -> !Integer.valueOf(0).equals(d.getStatus()) || d.getPurchaseId() != null)) throw new com.atguigu.common.security.ApiProblem(409, "已分配需求不能删除");
        removeByIds(ids);
    }

    @Override
    public PageUtils queryPage(Map<String, Object> params) {
        int pageNumber = Integer.parseInt((String) params.getOrDefault("page", "1"));
        int limit = Integer.parseInt((String) params.getOrDefault("limit", "20"));
        if (pageNumber < 1 || limit < 1 || limit > 100) throw new com.atguigu.common.security.ApiProblem(400, "分页参数不正确");

        /**
         * status
         * wareId
         */
        QueryWrapper<PurchaseDetailEntity> queryWrapper = new QueryWrapper<>();

        String key = (String) params.get("key");
        if (!StringUtils.isEmpty(key)) {
            // purchase_id sku_id
            queryWrapper.and(w -> {
                w.eq("purchase_id", key)
                        .or()
                        .eq("sku_id", key);
            });
        }

        String status = (String) params.get("status");
        if (!StringUtils.isEmpty(status)) {
            // purchase_id sku_id
            queryWrapper.eq("status", status);
        }
        String wareId = (String) params.getOrDefault("wareId", params.get("ware_id"));
        if (!StringUtils.isEmpty(wareId)) {
            // purchase_id sku_id
            queryWrapper.eq("ware_id", wareId);
        }
        if (params.get("purchaseId") != null && !params.get("purchaseId").toString().isEmpty()) queryWrapper.eq("purchase_id", Long.valueOf(params.get("purchaseId").toString()));
        queryWrapper.orderByDesc("id");


        IPage<PurchaseDetailEntity> page = this.page(
                new Query<PurchaseDetailEntity>().getPage(params),
                queryWrapper
        );

        return new PageUtils(page);
    }

    @Override
    public List<PurchaseDetailEntity> listDetailByPurchaseId(Long id) {
        QueryWrapper<PurchaseDetailEntity> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("purchase_id", id);
        List<PurchaseDetailEntity> purchaseId = this.list(queryWrapper);
        return purchaseId;
    }

}
