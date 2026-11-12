package com.atguigu.gulimall.member.service;

import com.atguigu.common.security.ApiProblem;
import com.atguigu.gulimall.member.entity.MemberReceiveAddressEntity;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.dao.DuplicateKeyException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigInteger;
import java.security.MessageDigest;
import java.util.*;

@Service
public class MemberAddressService {
    private final MemberReceiveAddressService addresses;
    private final JdbcTemplate db;
    private final TransactionTemplate transaction;
    private static final ObjectMapper JSON = new ObjectMapper();
    public MemberAddressService(MemberReceiveAddressService addresses, JdbcTemplate db, PlatformTransactionManager manager) {
        this.addresses=addresses; this.db=db; this.transaction=new TransactionTemplate(manager);
    }
    public MemberReceiveAddressEntity owned(Long id, long memberId) {
        MemberReceiveAddressEntity address=addresses.getById(id);
        if(address==null) throw new ApiProblem(404,"地址不存在");
        if(!Long.valueOf(memberId).equals(address.getMemberId())) throw new ApiProblem(403,"不能操作其他会员的地址");
        return address;
    }
    private void lock(long memberId) {
        // Lock the member even when they have no addresses; locking address rows alone leaves an insert race.
        if(db.queryForList("SELECT id FROM ums_member WHERE id=? FOR UPDATE",memberId).isEmpty()) throw new ApiProblem(401,"会员不存在，请重新登录");
    }
    private void normalize(long memberId, Long preferred) {
        if(preferred==null) {
            List<Long> defaults=db.queryForList("SELECT id FROM ums_member_receive_address WHERE member_id=? AND default_status=1 ORDER BY id",Long.class,memberId);
            if(!defaults.isEmpty()) preferred=defaults.get(0);
        }
        if(preferred!=null) db.update("UPDATE ums_member_receive_address SET default_status=0 WHERE member_id=? AND id<>? AND default_status=1",memberId,preferred);
    }
    public boolean multipleDefaults(long memberId) { return addresses.count(new QueryWrapper<MemberReceiveAddressEntity>().eq("member_id",memberId).eq("default_status",1))>1; }
    public Long save(Long id, MemberReceiveAddressEntity address, long memberId) {
        if(address==null) throw new ApiProblem(400,"地址不能为空");
        if(address.getDefaultStatus()==null) address.setDefaultStatus(0);
        if(address.getDefaultStatus()!=0 && address.getDefaultStatus()!=1) throw new ApiProblem(400,"默认地址状态不正确");
        String requestId=id==null?address.getCreationRequestId():null;
        if(requestId!=null) validateRequestId(requestId);
        String hash=requestId==null?null:digest(address);
        try {
            return transaction.execute(status -> {
                lock(memberId);
                if(id!=null) owned(id,memberId);
                address.setId(id); address.setMemberId(memberId);
                if(requestId!=null) {
                    Map<String,Object> previous=previous(memberId,requestId);
                    if(previous!=null) return replay(previous,hash);
                }
                if(!addresses.saveOrUpdate(address)) throw new ApiProblem(503,"地址未能保存，请查询原操作后重试");
                normalize(memberId,address.getDefaultStatus()==1?address.getId():null);
                if(requestId!=null && db.update("INSERT INTO ums_address_creation_receipt(member_id,creation_request_id,creation_request_hash,address_id) VALUES(?,?,?,?)",memberId,requestId,hash,address.getId())!=1) throw new ApiProblem(503,"地址回执未能保存，请查询原操作后重试");
                return address.getId();
            });
        } catch(DuplicateKeyException conflict) {
            // Normal creates share the member lock; read any unique-key winner only after rollback.
            Map<String,Object> previous=requestId==null?null:previous(memberId,requestId);
            if(previous!=null) return replay(previous,hash);
            throw conflict;
        }
    }
    private static void validateRequestId(String id) {
        if(id==null || !id.matches("[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}")) throw new ApiProblem(400,"地址创建请求标识不正确");
    }
    private Map<String,Object> previous(long memberId,String requestId) {
        List<Map<String,Object>> rows=db.queryForList("SELECT r.address_id,r.creation_request_hash,a.id AS present_id FROM ums_address_creation_receipt r LEFT JOIN ums_member_receive_address a ON a.id=r.address_id AND a.member_id=r.member_id WHERE r.member_id=? AND r.creation_request_id=?",memberId,requestId);
        return rows.isEmpty()?null:rows.get(0);
    }
    private Long replay(Map<String,Object> previous,String hash) {
        if(!hash.equals(previous.get("creation_request_hash"))) throw new ApiProblem(409,"同一地址创建请求不能修改内容，请先查询原地址");
        if(previous.get("present_id")==null) throw new ApiProblem(409,"原地址已删除，不能通过旧请求重新创建");
        return ((Number)previous.get("address_id")).longValue();
    }
    public Map<String,Object> creation(long memberId,String requestId) {
        validateRequestId(requestId);
        Map<String,Object> previous=previous(memberId,requestId),result=new LinkedHashMap<>();
        result.put("found",previous!=null);
        if(previous!=null) { result.put("id",previous.get("address_id")); result.put("deleted",previous.get("present_id")==null); }
        return result;
    }
    static String digest(MemberReceiveAddressEntity address) {
        try {
            byte[] canonical=JSON.writeValueAsBytes(Arrays.asList(address.getName(),address.getPhone(),address.getPostCode(),address.getProvince(),address.getCity(),address.getRegion(),address.getDetailAddress(),address.getAreacode(),address.getDefaultStatus()==null?0:address.getDefaultStatus()));
            return String.format("%064x",new BigInteger(1,MessageDigest.getInstance("SHA-256").digest(canonical)));
        } catch(java.security.NoSuchAlgorithmException | com.fasterxml.jackson.core.JsonProcessingException impossible) { throw new IllegalStateException(impossible); }
    }
    @Transactional
    public void makeDefault(Long id,long memberId) {
        lock(memberId); owned(id,memberId);
        db.update("UPDATE ums_member_receive_address SET default_status=1 WHERE id=? AND member_id=?",id,memberId);
        normalize(memberId,id);
    }
    @Transactional
    public void delete(Long[] ids,long memberId) {
        if(ids==null || ids.length==0 || ids.length>100 || Arrays.asList(ids).contains(null) || new HashSet<>(Arrays.asList(ids)).size()!=ids.length) throw new ApiProblem(400,"地址编号不正确");
        lock(memberId);
        for(Long id:ids) owned(id,memberId);
        addresses.remove(new QueryWrapper<MemberReceiveAddressEntity>().eq("member_id",memberId).in("id",(Object[])ids));
        normalize(memberId,null);
    }
}
