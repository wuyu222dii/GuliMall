package com.atguigu.gulimall.product.service;

import com.atguigu.common.security.ApiProblem;
import com.atguigu.gulimall.product.vo.SpuSaveVo;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.math.BigDecimal;
import java.math.BigInteger;
import java.security.MessageDigest;
import java.util.*;

@Service
public class ProductCreationService {
    private final SpuInfoService products;
    private final JdbcTemplate db;
    private final TransactionTemplate transaction;
    public ProductCreationService(SpuInfoService products,JdbcTemplate db,PlatformTransactionManager manager) {
        this.products=products;this.db=db;this.transaction=new TransactionTemplate(manager);
    }
    private static void validate(String requestId) {
        if(requestId==null || !requestId.matches("[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}")) throw new ApiProblem(400,"商品创建请求标识不正确");
    }
    public Map<String,Object> find(String requestId) {
        validate(requestId);
        List<Map<String,Object>> rows=db.queryForList("SELECT id,creation_request_hash FROM pms_spu_info WHERE creation_request_id=?",requestId);
        return rows.isEmpty()?null:rows.get(0);
    }
    private Long replay(Map<String,Object> previous,String hash) {
        if(!hash.equals(previous.get("creation_request_hash"))) throw new ApiProblem(409,"同一创建请求不能修改内容，请先查询原商品");
        return ((Number)previous.get("id")).longValue();
    }
    public Long save(SpuSaveVo product) {
        if(product==null) throw new ApiProblem(400,"商品信息不能为空");
        if(product.getId()!=null || product.getCreationRequestId()==null) return products.saveSpuInfo(product);
        String requestId=product.getCreationRequestId();validate(requestId);
        String hash=digest(product);
        Map<String,Object> previous=find(requestId);
        if(previous!=null) return replay(previous,hash);
        try {
            return transaction.execute(status->{
                Long id=products.saveSpuInfo(product);
                db.update("UPDATE pms_spu_info SET creation_request_id=?,creation_request_hash=? WHERE id=?",requestId,hash,id);
                return id;
            });
        } catch(DuplicateKeyException conflict) {
            // Read only after the losing transaction has rolled back; all of its SPU/SKU writes must roll back together.
            previous=find(requestId);
            if(previous!=null) return replay(previous,hash);
            throw conflict;
        }
    }
    static String digest(SpuSaveVo product) {
        ObjectMapper mapper=new ObjectMapper();
        ObjectNode root=mapper.valueToTree(product);
        root.retain("spuName","spuDescription","catalogId","brandId","weight","images","decript","baseAttrs","skus");
        if(root.path("baseAttrs").isArray()) for(JsonNode attr:root.path("baseAttrs")) if(attr.isObject()) ((ObjectNode)attr).retain("attrId","attrValues","showDesc");
        if(root.path("skus").isArray()) for(JsonNode sku:root.path("skus")) if(sku.isObject()) {
            ((ObjectNode)sku).retain("skuId","skuName","skuTitle","skuSubtitle","price","images","attr");
            if(sku.path("images").isArray()) for(JsonNode image:sku.path("images")) if(image.isObject()) ((ObjectNode)image).retain("imgUrl","defaultImg");
            if(sku.path("attr").isArray()) for(JsonNode attr:sku.path("attr")) if(attr.isObject()) ((ObjectNode)attr).retain("attrId","attrValue");
        }
        try { return String.format("%064x",new BigInteger(1,MessageDigest.getInstance("SHA-256").digest(mapper.writeValueAsBytes(canonical(root))))); }
        catch(Exception e) { throw new IllegalStateException("Cannot digest product creation",e); }
    }
    private static Object canonical(JsonNode value) {
        if(value.isObject()) { Map<String,Object> result=new TreeMap<>();value.fields().forEachRemaining(e->result.put(e.getKey(),canonical(e.getValue())));return result; }
        if(value.isArray()) { List<Object> result=new ArrayList<>();value.forEach(e->result.add(canonical(e)));return result; }
        if(value.isNumber()) return new BigDecimal(value.asText()).stripTrailingZeros().toPlainString();
        if(value.isNull()) return null;
        if(value.isBoolean()) return value.asBoolean();
        return value.asText();
    }
}
