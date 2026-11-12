package com.atguigu.gulimall.ware.service;

import com.atguigu.common.security.ApiProblem;
import com.atguigu.gulimall.ware.entity.WareInfoEntity;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.math.BigInteger;
import java.security.MessageDigest;
import java.util.*;

@Service
public class WarehouseCreationService {
    private final WareInfoService warehouses;
    private final JdbcTemplate db;
    private final TransactionTemplate transaction;
    private static final ObjectMapper JSON = new ObjectMapper();
    public WarehouseCreationService(WareInfoService warehouses,JdbcTemplate db,PlatformTransactionManager manager) {
        this.warehouses=warehouses; this.db=db; this.transaction=new TransactionTemplate(manager);
    }
    public static WareInfoEntity validated(WareInfoEntity input) {
        if(input==null || input.getName()==null || input.getName().trim().isEmpty() || input.getName().length()>100 || input.getAddress()==null || input.getAddress().trim().isEmpty() || input.getAddress().length()>255 || input.getAreacode()!=null && input.getAreacode().length()>20) throw new ApiProblem(400,"仓库名称、地址或区域编码不正确");
        WareInfoEntity value=new WareInfoEntity(); value.setName(input.getName().trim()); value.setAddress(input.getAddress().trim()); value.setAreacode(input.getAreacode()==null?"":input.getAreacode().trim()); return value;
    }
    private static void validateRequestId(String id) {
        if(id==null || !id.matches("[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}")) throw new ApiProblem(400,"仓库创建请求标识不正确");
    }
    private Map<String,Object> previous(String requestId) {
        List<Map<String,Object>> rows=db.queryForList("SELECT id,creation_request_hash FROM wms_ware_info WHERE creation_request_id=?",requestId);
        return rows.isEmpty()?null:rows.get(0);
    }
    private Long replay(Map<String,Object> previous,String hash) {
        if(!hash.equals(previous.get("creation_request_hash"))) throw new ApiProblem(409,"同一仓库创建请求不能修改内容，请先查询原仓库");
        return ((Number)previous.get("id")).longValue();
    }
    public Map<String,Object> creation(String requestId) {
        validateRequestId(requestId);
        Map<String,Object> previous=previous(requestId),result=new LinkedHashMap<>(); result.put("found",previous!=null);
        if(previous!=null) { result.put("id",previous.get("id")); result.put("deleted",false); }
        return result;
    }
    public Long save(WareInfoEntity input) {
        WareInfoEntity value=validated(input);
        String requestId=input.getCreationRequestId();
        if(requestId==null) { if(!warehouses.save(value)) throw new ApiProblem(503,"仓库未能保存，请查询原操作后重试"); return value.getId(); }
        validateRequestId(requestId); String hash=digest(value);
        Map<String,Object> previous=previous(requestId);
        if(previous!=null) return replay(previous,hash);
        try {
            return transaction.execute(status -> {
                if(!warehouses.save(value)) throw new ApiProblem(503,"仓库未能保存，请查询原操作后重试");
                if(db.update("UPDATE wms_ware_info SET creation_request_id=?,creation_request_hash=? WHERE id=?",requestId,hash,value.getId())!=1) throw new ApiProblem(503,"仓库回执未能保存，请查询原操作后重试");
                return value.getId();
            });
        } catch(DuplicateKeyException conflict) {
            // All writes in the losing transaction have rolled back before the winner is read.
            previous=previous(requestId);
            if(previous!=null) return replay(previous,hash);
            throw conflict;
        }
    }
    static String digest(WareInfoEntity value) {
        try { return String.format("%064x",new BigInteger(1,MessageDigest.getInstance("SHA-256").digest(JSON.writeValueAsBytes(Arrays.asList(value.getName(),value.getAddress(),value.getAreacode()))))); }
        catch(java.security.NoSuchAlgorithmException | com.fasterxml.jackson.core.JsonProcessingException impossible) { throw new IllegalStateException(impossible); }
    }
}
