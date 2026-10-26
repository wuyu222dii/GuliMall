package com.atguigu.gulimall.member.service;

import com.atguigu.common.security.ApiProblem;
import com.atguigu.gulimall.member.entity.MemberReceiveAddressEntity;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

@Service
public class MemberAddressService {
    private final MemberReceiveAddressService addresses;
    private final JdbcTemplate db;
    public MemberAddressService(MemberReceiveAddressService addresses, JdbcTemplate db) { this.addresses=addresses; this.db=db; }
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
    @Transactional
    public Long save(Long id, MemberReceiveAddressEntity address, long memberId) {
        lock(memberId);
        if(id!=null) owned(id,memberId);
        address.setId(id); address.setMemberId(memberId);
        if(address.getDefaultStatus()==null) address.setDefaultStatus(0);
        if(address.getDefaultStatus()!=0 && address.getDefaultStatus()!=1) throw new ApiProblem(400,"默认地址状态不正确");
        addresses.saveOrUpdate(address);
        normalize(memberId,address.getDefaultStatus()==1?address.getId():null);
        return address.getId();
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
