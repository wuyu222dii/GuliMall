package com.atguigu.gulimall.member.controller;

import com.atguigu.common.security.*;
import com.atguigu.common.utils.*;
import com.atguigu.gulimall.member.entity.MemberReceiveAddressEntity;
import com.atguigu.gulimall.member.service.MemberReceiveAddressService;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import javax.servlet.http.HttpServletRequest;
import javax.validation.Valid;
import java.util.*;

@RestController
@RequestMapping("/member/addresses")
public class MemberAddressController {
    @Autowired private MemberReceiveAddressService addresses;
    @GetMapping
    public R list(@RequestParam Map<String,Object> params, HttpServletRequest request) {
        int limit = Integer.parseInt((String) params.getOrDefault("limit", "20"));
        int page = Integer.parseInt((String) params.getOrDefault("page", "1"));
        if (limit < 1 || limit > 100 || page < 1) { throw new ApiProblem(400, "分页参数不正确"); }
        return R.ok().put("page", new PageUtils(addresses.page(new Query<MemberReceiveAddressEntity>().getPage(params),
                new QueryWrapper<MemberReceiveAddressEntity>().eq("member_id", RequestIdentity.memberId(request)))));
    }
    @GetMapping("/{id}")
    public R info(@PathVariable Long id, HttpServletRequest request) {
        return R.ok().put("memberReceiveAddress", owned(id, RequestIdentity.memberId(request)));
    }
    @PostMapping
    public R save(@Valid @RequestBody MemberReceiveAddressEntity address, HttpServletRequest request) {
        address.setId(null);
        address.setMemberId(RequestIdentity.memberId(request));
        validateDefault(address);
        addresses.save(address);
        return R.ok().put("id", address.getId());
    }
    @PutMapping("/{id}")
    public R update(@PathVariable Long id, @Valid @RequestBody MemberReceiveAddressEntity address, HttpServletRequest request) {
        long memberId = RequestIdentity.memberId(request);
        owned(id, memberId);
        address.setId(id);
        address.setMemberId(memberId);
        validateDefault(address);
        addresses.update(address, new QueryWrapper<MemberReceiveAddressEntity>().eq("id", id).eq("member_id", memberId));
        return R.ok();
    }
    @DeleteMapping
    public R delete(@RequestBody Long[] ids, HttpServletRequest request) {
        long memberId = RequestIdentity.memberId(request);
        if (ids == null || ids.length == 0 || ids.length > 100 || Arrays.asList(ids).contains(null)
                || new HashSet<>(Arrays.asList(ids)).size() != ids.length) { throw new ApiProblem(400, "地址编号不正确"); }
        if (addresses.count(new QueryWrapper<MemberReceiveAddressEntity>().eq("member_id", memberId).in("id", (Object[]) ids)) != ids.length) {
            throw new ApiProblem(403, "不能操作其他会员的地址");
        }
        addresses.remove(new QueryWrapper<MemberReceiveAddressEntity>().eq("member_id", memberId).in("id", (Object[]) ids));
        return R.ok();
    }
    private MemberReceiveAddressEntity owned(Long id, long memberId) {
        MemberReceiveAddressEntity address = addresses.getById(id);
        if (address == null) { throw new ApiProblem(404, "地址不存在"); }
        if (!Long.valueOf(memberId).equals(address.getMemberId())) { throw new ApiProblem(403, "不能操作其他会员的地址"); }
        return address;
    }
    private void validateDefault(MemberReceiveAddressEntity address) {
        if (address.getDefaultStatus() == null) { address.setDefaultStatus(0); }
        if (address.getDefaultStatus() != 0 && address.getDefaultStatus() != 1) { throw new ApiProblem(400, "默认地址状态不正确"); }
    }
}
