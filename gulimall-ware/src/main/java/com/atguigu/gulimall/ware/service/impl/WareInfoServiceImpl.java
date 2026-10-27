package com.atguigu.gulimall.ware.service.impl;

import com.baomidou.mybatisplus.core.toolkit.StringUtils;
import org.springframework.stereotype.Service;

import java.util.Map;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.atguigu.common.utils.PageUtils;
import com.atguigu.common.utils.Query;

import com.atguigu.gulimall.ware.dao.WareInfoDao;
import com.atguigu.gulimall.ware.entity.WareInfoEntity;
import com.atguigu.gulimall.ware.service.WareInfoService;


@Service("wareInfoService")
public class WareInfoServiceImpl extends ServiceImpl<WareInfoDao, WareInfoEntity> implements WareInfoService {

    @Override
    public PageUtils queryPage(Map<String, Object> params) {
        int pageNumber=Integer.parseInt(String.valueOf(params.getOrDefault("page","1"))),pageSize=Integer.parseInt(String.valueOf(params.getOrDefault("limit","20")));
        if(pageNumber<1 || pageNumber>1000000 || pageSize<1 || pageSize>100) throw new com.atguigu.common.security.ApiProblem(400,"分页参数不正确");
        QueryWrapper<WareInfoEntity> wareInfoEntityQueryWrapper = new QueryWrapper<>();
        String key = (String) params.get("key");
        if(key!=null && key.length()>100) throw new com.atguigu.common.security.ApiProblem(400,"仓库查询条件过长");
        if (!StringUtils.isEmpty(key)) {
            wareInfoEntityQueryWrapper.eq("id", key)
                    .or()
                    .like("name", key)
                    .or()
                    .like("address", key)
                    .or()
                    .like("areacode", key);
        }

        IPage<WareInfoEntity> page = this.page(
                new Query<WareInfoEntity>().getPage(params),
                wareInfoEntityQueryWrapper.orderByAsc("id")
        );

        return new PageUtils(page);
    }

}
