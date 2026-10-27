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
    @Autowired private com.atguigu.gulimall.member.service.MemberAddressService mutations;
    @GetMapping
    public R list(@RequestParam Map<String,Object> params, HttpServletRequest request) {
        int limit = Integer.parseInt((String) params.getOrDefault("limit", "20"));
        int page = Integer.parseInt((String) params.getOrDefault("page", "1"));
        if (limit < 1 || limit > 100 || page < 1) { throw new ApiProblem(400, "分页参数不正确"); }
        long memberId=RequestIdentity.memberId(request);
        return R.ok().put("page", new PageUtils(addresses.page(new Query<MemberReceiveAddressEntity>().getPage(params),
                new QueryWrapper<MemberReceiveAddressEntity>().eq("member_id",memberId).orderByDesc("default_status","id"))))
                .put("multipleDefaults",mutations.multipleDefaults(memberId));
    }
    @GetMapping("/{id}")
    public R info(@PathVariable Long id, HttpServletRequest request) {
        return R.ok().put("memberReceiveAddress", mutations.owned(id, RequestIdentity.memberId(request)));
    }
    @PostMapping
    public R save(@Valid @RequestBody MemberReceiveAddressEntity address, HttpServletRequest request) {
        return R.ok().put("id",mutations.save(null,address,RequestIdentity.memberId(request)));
    }
    @PutMapping("/{id}")
    public R update(@PathVariable Long id, @Valid @RequestBody MemberReceiveAddressEntity address, HttpServletRequest request) {
        mutations.save(id,address,RequestIdentity.memberId(request));
        return R.ok();
    }
    @PutMapping("/{id}/default")
    public R makeDefault(@PathVariable Long id,HttpServletRequest request) {
        mutations.makeDefault(id,RequestIdentity.memberId(request)); return R.ok();
    }
    @DeleteMapping
    public R delete(@RequestBody Long[] ids, HttpServletRequest request) {
        mutations.delete(ids,RequestIdentity.memberId(request));
        return R.ok();
    }
}
