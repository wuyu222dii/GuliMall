package com.atguigu.gulimall.member.service.impl;

import org.springframework.stereotype.Service;
import java.util.Map;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.atguigu.common.utils.PageUtils;
import com.atguigu.common.utils.Query;

import com.atguigu.gulimall.member.dao.SmsSeckillSkuNoticeDao;
import com.atguigu.gulimall.member.entity.SmsSeckillSkuNoticeEntity;
import com.atguigu.gulimall.member.service.SmsSeckillSkuNoticeService;


@Service("smsSeckillSkuNoticeService")
public class SmsSeckillSkuNoticeServiceImpl extends ServiceImpl<SmsSeckillSkuNoticeDao, SmsSeckillSkuNoticeEntity> implements SmsSeckillSkuNoticeService {

    @Override
    public PageUtils queryPage(Map<String, Object> params) {
        IPage<SmsSeckillSkuNoticeEntity> page = this.page(
                new Query<SmsSeckillSkuNoticeEntity>().getPage(params),
                new QueryWrapper<SmsSeckillSkuNoticeEntity>()
        );

        return new PageUtils(page);
    }

}