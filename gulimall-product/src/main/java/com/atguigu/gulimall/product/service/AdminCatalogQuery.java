package com.atguigu.gulimall.product.service;

import com.atguigu.common.security.ApiProblem;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import org.springframework.util.MultiValueMap;
import java.util.*;

public final class AdminCatalogQuery {
    public final String kind, idColumn, nameColumn, key, catalogId, status, type;
    public final int page, limit;
    public AdminCatalogQuery(String kind, MultiValueMap<String,String> params) {
        this.kind=kind;
        switch(kind) {
            case "brands": idColumn="brand_id"; nameColumn="name"; break;
            case "groups": idColumn="attr_group_id"; nameColumn="attr_group_name"; break;
            case "attrs": idColumn="attr_id"; nameColumn="attr_name"; break;
            default: throw new ApiProblem(400,"分页资料类型不正确");
        }
        if(params.keySet().stream().anyMatch(k -> !Arrays.asList("page","limit","key","catalogId","status","type").contains(k) || params.get(k).size()!=1)) throw new ApiProblem(400,"资料查询参数不正确");
        page=number(params,"page",1,1000000); limit=number(params,"limit",20,100);
        key=value(params,"key").trim(); catalogId=value(params,"catalogId"); status=value(params,"status"); type=value(params,"type");
        if(key.length()>100 || !catalogId.isEmpty() && !catalogId.matches("[1-9][0-9]{0,17}") || !status.isEmpty() && !status.matches("[01]") || !type.isEmpty() && !type.matches("[01]")) throw new ApiProblem(400,"资料筛选条件不正确");
        if(kind.equals("brands") && !catalogId.isEmpty() || kind.equals("groups") && !status.isEmpty() || !kind.equals("attrs") && !type.isEmpty()) throw new ApiProblem(400,"当前资料类型不支持这些条件");
    }
    private static String value(MultiValueMap<String,String> params,String key) { String value=params.getFirst(key); return value==null?"":value; }
    private static int number(MultiValueMap<String,String> params,String key,int fallback,int max) {
        String value=params.getFirst(key);
        if(value==null) return fallback;
        if(!value.matches("[1-9][0-9]{0,6}")) throw new ApiProblem(400,"资料分页参数不正确");
        int result=Integer.parseInt(value); if(result>max) throw new ApiProblem(400,"资料分页参数超出范围"); return result;
    }
    public <T> QueryWrapper<T> conditions(boolean unfiltered) {
        QueryWrapper<T> where=new QueryWrapper<>();
        if(unfiltered) return where;
        if(!key.isEmpty()) where.and(w -> {
            String literal="%"+key.replace("!","!!").replace("%","!%").replace("_","!_")+"%";
            w.apply(nameColumn+" LIKE {0} ESCAPE '!'",literal);
            if(key.matches("[1-9][0-9]{0,17}")) w.or().eq(idColumn,key);
        });
        if(!catalogId.isEmpty()) where.eq("catelog_id",catalogId);
        if(!status.isEmpty()) where.eq(kind.equals("brands")?"show_status":"enable",status);
        if(!type.isEmpty()) where.eq("attr_type",type);
        return where;
    }
}
