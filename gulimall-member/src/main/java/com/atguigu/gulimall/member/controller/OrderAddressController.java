package com.atguigu.gulimall.member.controller;
import com.atguigu.common.security.ApiProblem;
import com.atguigu.common.utils.R;
import com.atguigu.gulimall.member.entity.MemberReceiveAddressEntity;
import com.atguigu.gulimall.member.service.MemberReceiveAddressService;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping("/internal/member/{memberId}/addresses")
public class OrderAddressController {
    @Autowired private MemberReceiveAddressService addresses;
    @GetMapping public R list(@PathVariable long memberId) {
        return R.ok().put("data",addresses.list(new QueryWrapper<MemberReceiveAddressEntity>().eq("member_id",memberId).orderByDesc("default_status").orderByAsc("id").last("LIMIT 100")));
    }
    @GetMapping("/{id}") public R owned(@PathVariable long memberId,@PathVariable long id) {
        MemberReceiveAddressEntity address=addresses.getById(id);
        if(address==null) throw new ApiProblem(404,"地址不存在");
        if(!Long.valueOf(memberId).equals(address.getMemberId())) throw new ApiProblem(403,"不能使用其他会员的地址");
        return R.ok().put("data",address);
    }
}
