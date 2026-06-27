package com.atguigu.gulimall.member.dao;

import com.atguigu.gulimall.member.entity.SmsHomeSubjectEntity;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * Home Subject [JD homepage has many subjects below; each subject links to a new page showing subject product info]
 * 
 * @author liurui
 * @email liurui@gmail.com
 * @date 2023-10-18 15:33:25
 */
@Mapper
public interface SmsHomeSubjectDao extends BaseMapper<SmsHomeSubjectEntity> {
	
}
