package com.atguigu.gulimall.ware.service;

import com.atguigu.common.security.ApiProblem;
import com.atguigu.gulimall.ware.entity.PurchaseDetailEntity;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.nio.charset.StandardCharsets;
import java.math.BigInteger;
import java.security.MessageDigest;
import java.util.*;

@Service
public class DemandCreationService {
    private final PurchaseDetailService details;
    private final JdbcTemplate db;
    private final TransactionTemplate transaction;
    public DemandCreationService(PurchaseDetailService details, JdbcTemplate db, PlatformTransactionManager manager) {
        this.details = details; this.db = db; this.transaction = new TransactionTemplate(manager);
    }
    private static void validateId(String id) {
        if (id == null || !id.matches("[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}"))
            throw new ApiProblem(400, "采购创建请求标识不正确");
    }
    private Map<String,Object> previous(String id) {
        List<Map<String,Object>> rows = db.queryForList("SELECT id,creation_request_hash,deleted,status,purchase_id FROM wms_purchase_detail WHERE creation_request_id=?", id);
        return rows.isEmpty() ? null : rows.get(0);
    }
    public Map<String,Object> find(String id) {
        validateId(id);
        Map<String,Object> row = previous(id), result = new LinkedHashMap<>();
        result.put("found", row != null);
        if (row != null) {
            result.put("id", row.get("id")); result.put("deleted", ((Number)row.get("deleted")).intValue() == 1);
            result.put("status", row.get("status")); result.put("purchaseId", row.get("purchase_id"));
        }
        return result;
    }
    private Long replay(Map<String,Object> row, String hash) {
        if (!hash.equals(row.get("creation_request_hash"))) throw new ApiProblem(409, "同一采购创建请求不能修改内容，请先查询原需求");
        if (((Number)row.get("deleted")).intValue() == 1) throw new ApiProblem(409, "原采购需求已删除，不能通过旧请求重新创建");
        return ((Number)row.get("id")).longValue();
    }
    public Long save(PurchaseDetailEntity request) {
        if (request == null) throw new ApiProblem(400, "采购需求不能为空");
        if (request.getId() != null || request.getCreationRequestId() == null) return details.saveDemand(request);
        String requestId = request.getCreationRequestId(); validateId(requestId);
        com.atguigu.gulimall.ware.service.impl.PurchaseDetailServiceImpl.validateDemand(request);
        String hash = digest(request);
        Map<String,Object> row = previous(requestId);
        if (row != null) return replay(row, hash);
        try {
            return transaction.execute(status -> {
                Long id = details.saveDemand(request);
                db.update("UPDATE wms_purchase_detail SET creation_request_id=?,creation_request_hash=? WHERE id=?", requestId, hash, id);
                return id;
            });
        } catch (DuplicateKeyException conflict) {
            // Read the winner only after all writes in the losing transaction have rolled back.
            row = previous(requestId);
            if (row != null) return replay(row, hash);
            throw conflict;
        }
    }
    static String digest(PurchaseDetailEntity request) {
        String canonical = request.getSkuId() + "\n" + request.getWareId() + "\n" + request.getSkuNum() + "\n" + request.getSkuPrice().setScale(2).toPlainString();
        try { return String.format("%064x", new BigInteger(1, MessageDigest.getInstance("SHA-256").digest(canonical.getBytes(StandardCharsets.UTF_8)))); }
        catch (java.security.NoSuchAlgorithmException impossible) { throw new IllegalStateException(impossible); }
    }
}
