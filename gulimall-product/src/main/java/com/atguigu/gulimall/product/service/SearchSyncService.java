package com.atguigu.gulimall.product.service;

import com.alibaba.fastjson.TypeReference;
import com.atguigu.common.security.ApiProblem;
import com.atguigu.common.to.SearchSyncRequest;
import com.atguigu.common.to.SkuHasStockVo;
import com.atguigu.common.to.es.SkuEsModel;
import com.atguigu.common.utils.*;
import com.atguigu.gulimall.product.feign.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class SearchSyncService {
    @Autowired private JdbcTemplate db;
    @Autowired private SearchFeignService search;
    @Autowired private WareFeignService warehouse;
    private static final String QUEUE = "INSERT INTO pms_search_sync(spu_id,version,state,attempts,next_attempt,updated_at) SELECT id,1,0,0,NOW(),NOW() FROM pms_spu_info WHERE ";
    private static final String UPSERT = " ON DUPLICATE KEY UPDATE version=version+1,state=0,attempts=0,last_error=NULL,next_attempt=NOW(),updated_at=NOW()";

    @Transactional public void enqueue(Long id) { db.update(QUEUE + "id=?" + UPSERT, id); }
    @Transactional public void changed(Long id) {
        db.update(QUEUE + "id=? AND (publish_status=1 OR EXISTS(SELECT 1 FROM pms_search_sync s WHERE s.spu_id=id))" + UPSERT, id);
    }
    @Transactional public int rebuild() { return db.update(QUEUE + "1=1 ORDER BY id" + UPSERT); }
    @Transactional public void metadataChanged(String field, Long id) {
        if (!Arrays.asList("brand_id", "catalog_id").contains(field)) throw new IllegalArgumentException("Invalid metadata field");
        db.update(QUEUE + field + "=? AND publish_status=1 ORDER BY id" + UPSERT, id);
    }
    @Transactional public void attributeChanged(Long id) {
        db.update(QUEUE + "publish_status=1 AND id IN (SELECT spu_id FROM pms_product_attr_value WHERE attr_id=?) ORDER BY id" + UPSERT, id);
    }
    @Transactional public void publish(Long id, int status) {
        if (status != 0 && status != 1) throw new ApiProblem(400, "上下架状态不正确");
        if (db.queryForList("SELECT id FROM pms_spu_info WHERE id=? FOR UPDATE", id).isEmpty()) throw new ApiProblem(404, "商品不存在");
        if (status == 1 && db.queryForObject("SELECT COUNT(*) FROM pms_sku_info WHERE spu_id=? AND price>=0", Integer.class, id) == 0) throw new ApiProblem(409, "商品尚无有效 SKU");
        db.update("UPDATE pms_spu_info SET publish_status=?,update_time=NOW() WHERE id=?", status, id); enqueue(id);
    }
    public Map<String,Object> status(Long id) {
        List<Map<String,Object>> result = db.queryForList("SELECT * FROM pms_search_sync WHERE spu_id=?", id);
        return result.isEmpty() ? null : result.get(0);
    }
    public PageUtils list(int page, int limit) {
        if (page < 1 || page > 100000 || limit < 1 || limit > 100) throw new ApiProblem(400, "分页参数不正确");
        return new PageUtils(db.queryForList("SELECT s.*,p.spu_name,p.publish_status FROM pms_search_sync s JOIN pms_spu_info p ON p.id=s.spu_id ORDER BY s.state DESC,s.updated_at DESC,s.spu_id LIMIT ? OFFSET ?", limit, (page-1)*limit),
                db.queryForObject("SELECT COUNT(*) FROM pms_search_sync", Integer.class), limit, page);
    }
    public List<Long> due() { return db.queryForList("SELECT spu_id FROM pms_search_sync WHERE state<>1 AND next_attempt<=NOW() ORDER BY next_attempt,spu_id LIMIT 20", Long.class); }
    @Transactional public boolean synchronize(Long id) {
        List<Map<String,Object>> products = db.queryForList("SELECT * FROM pms_spu_info WHERE id=? FOR UPDATE", id);
        if (products.isEmpty()) throw new ApiProblem(404, "商品不存在");
        List<Map<String,Object>> jobs = db.queryForList("SELECT * FROM pms_search_sync WHERE spu_id=? FOR UPDATE", id);
        if (jobs.isEmpty()) throw new ApiProblem(404, "同步任务不存在");
        Map<String,Object> job = jobs.get(0);
        if (((Number)job.get("state")).intValue() == 1) return true;
        String error = null;
        try {
            SearchSyncRequest request = build(products.get(0), ((Number)job.get("version")).longValue());
            if (!request.getSkus().isEmpty()) {
                R response = search.synchronize(request);
                if (response.getCode() != 0) throw new ApiProblem(503, "搜索同步失败");
            }
        } catch (Exception unavailable) { error = "搜索或库存服务不可用，或商品资料不完整；请检查服务与商品后重试"; }
        db.update("UPDATE pms_search_sync SET state=?,attempts=attempts+1,last_error=?,next_attempt=DATE_ADD(NOW(),INTERVAL 30 SECOND),updated_at=NOW() WHERE spu_id=?", error == null ? 1 : 2, error, id);
        return error == null;
    }
    private SearchSyncRequest build(Map<String,Object> spu, long version) {
        Long id = ((Number)spu.get("id")).longValue();
        boolean onSale = Integer.valueOf(1).equals(spu.get("publish_status"));
        List<Map<String,Object>> skus = db.queryForList("SELECT * FROM pms_sku_info WHERE spu_id=? ORDER BY sku_id", id);
        SearchSyncRequest request = new SearchSyncRequest(); request.setSpuId(id); request.setVersion(version); request.setOnSale(onSale);
        List<SkuEsModel> models = new ArrayList<>(); request.setSkus(models);
        if (!onSale) {
            for (Map<String,Object> sku : skus) { SkuEsModel model = new SkuEsModel(); model.setSkuId(((Number)sku.get("sku_id")).longValue()); model.setSpuId(id); models.add(model); }
            return request;
        }
        if (skus.isEmpty()) throw new ApiProblem(409, "商品无 SKU");
        Map<String,Object> brand = db.queryForMap("SELECT * FROM pms_brand WHERE brand_id=? AND show_status=1", spu.get("brand_id"));
        Map<String,Object> category = db.queryForMap("SELECT * FROM pms_category WHERE cat_id=? AND show_status=1", spu.get("catalog_id"));
        List<Long> ids = skus.stream().map(s -> ((Number)s.get("sku_id")).longValue()).collect(Collectors.toList());
        R stock = warehouse.getSkuHasStock(ids);
        if (stock.getCode() != 0) throw new ApiProblem(503, "库存未知");
        List<SkuHasStockVo> values = stock.getData("data", new TypeReference<List<SkuHasStockVo>>(){});
        Map<Long,Boolean> available = new HashMap<>();
        if (values != null) for (SkuHasStockVo value : values) if (value.getHasStock() != null) available.put(value.getSkuId(), value.getHasStock());
        if (!available.keySet().containsAll(ids)) throw new ApiProblem(503, "库存未知");
        List<SkuEsModel.Attrs> attrs = db.queryForList("SELECT v.attr_id,a.attr_name,v.attr_value FROM pms_product_attr_value v JOIN pms_attr a ON a.attr_id=v.attr_id WHERE v.spu_id=? AND a.enable=1", id).stream().map(a -> {
            SkuEsModel.Attrs attr = new SkuEsModel.Attrs(); attr.setAttrId(((Number)a.get("attr_id")).longValue()); attr.setAttrName((String)a.get("attr_name")); attr.setAttrValue((String)a.get("attr_value")); return attr;
        }).collect(Collectors.toList());
        for (Map<String,Object> sku : skus) {
            Long skuId = ((Number)sku.get("sku_id")).longValue();
            ProductInputs.amount((BigDecimal)sku.get("price"), "售价");
            SkuEsModel model = new SkuEsModel(); model.setSkuId(skuId); model.setSpuId(id); model.setSkuName((String)sku.get("sku_name")); model.setSkuTitle((String)sku.get("sku_title"));
            model.setSkuPrice((BigDecimal)sku.get("price")); model.setSkuImg((String)sku.get("sku_default_img")); model.setHasStock(available.get(skuId));
            model.setBrandId(((Number)spu.get("brand_id")).longValue()); model.setCatalogId(((Number)spu.get("catalog_id")).longValue());
            model.setBrandName((String)brand.get("name")); model.setBrandImg((String)brand.get("logo")); model.setCatalogName((String)category.get("name"));
            model.setSaleCount(sku.get("sale_count") == null ? 0L : ((Number)sku.get("sale_count")).longValue()); model.setHotScore(0L); model.setAttrs(attrs); models.add(model);
        }
        return request;
    }
    // shortcut: refresh 100 published products per minute; use inventory events when order traffic is introduced.
    @Transactional public long refreshStock(long cursor) {
        List<Long> ids = db.queryForList("SELECT id FROM pms_spu_info WHERE publish_status=1 AND id>? ORDER BY id LIMIT 100", Long.class, cursor);
        for (Long id : ids) db.update(QUEUE + "id=? AND NOT EXISTS(SELECT 1 FROM pms_search_sync s WHERE s.spu_id=id AND s.state<>1)" + UPSERT, id);
        return ids.size() < 100 ? 0 : ids.get(ids.size()-1);
    }
}
