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
    private long member(HttpServletRequest request) {
        long id=RequestIdentity.memberId(request);
        String expected=request.getHeader("X-Address-Owner");
        if(expected!=null && !expected.equals(Long.toString(id))) throw new ApiProblem(409,"登录会员已变化，请重新登录后核对原地址请求");
        return id;
    }
    @GetMapping
    public R list(@RequestParam org.springframework.util.MultiValueMap<String,String> query, HttpServletRequest request) {
        if(query.containsKey("sidx") || query.containsKey("order")) throw new ApiProblem(400,"地址查询不支持排序参数");
        Map<String,Object> params=Query.singleParameters(query);
        int limit = Integer.parseInt((String) params.getOrDefault("limit", "20"));
        int page = Integer.parseInt((String) params.getOrDefault("page", "1"));
        if (limit < 1 || limit > 100 || page < 1 || page > 1000000 || !String.valueOf(params.getOrDefault("page","1")).matches("[1-9][0-9]{0,6}")) { throw new ApiProblem(400, "分页参数不正确"); }
        long memberId=member(request);
        return R.ok().put("page", new PageUtils(addresses.page(new Query<MemberReceiveAddressEntity>().getPage(params),
                new QueryWrapper<MemberReceiveAddressEntity>().eq("member_id",memberId).orderByDesc("default_status","id"))))
                .put("multipleDefaults",mutations.multipleDefaults(memberId));
    }
    @GetMapping("/{id}")
    public R info(@PathVariable Long id, HttpServletRequest request) {
        return R.ok().put("memberReceiveAddress", mutations.owned(id, member(request)));
    }
    @GetMapping("/creation/{requestId}")
    public R creation(@PathVariable String requestId,HttpServletRequest request) {
        return R.ok(mutations.creation(member(request),requestId));
    }
    @PostMapping
    public R save(@Valid @RequestBody MemberReceiveAddressEntity address, HttpServletRequest request) {
        return R.ok().put("id",mutations.save(null,address,member(request)));
    }
    @PutMapping("/{id}")
    public R update(@PathVariable Long id, @Valid @RequestBody MemberReceiveAddressEntity address, HttpServletRequest request) {
        mutations.save(id,address,member(request));
        return R.ok();
    }
    @PutMapping("/{id}/default")
    public R makeDefault(@PathVariable Long id,HttpServletRequest request) {
        mutations.makeDefault(id,member(request)); return R.ok();
    }
    @DeleteMapping
    public R delete(@RequestBody Long[] ids, HttpServletRequest request) {
        mutations.delete(ids,member(request));
        return R.ok();
    }
}
