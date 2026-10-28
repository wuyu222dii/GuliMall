/**
 * Copyright (c) 2016-2019 Renren Open Source All rights reserved.
 *
 * https://www.renren.io
 *
 * All rights reserved.
 */

package com.atguigu.common.utils;

import com.atguigu.common.xss.SQLFilter;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.core.metadata.OrderItem;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.apache.commons.lang.StringUtils;

import java.util.Map;

/**
 * Query parameters
 *
 * @author Mark sunlightcs@gmail.com
 */
public class Query<T> {

    public static Map<String,Object> singleParameters(org.springframework.util.MultiValueMap<String,String> params, String... fields) {
        java.util.Set<String> allowed = new java.util.HashSet<>(java.util.Arrays.asList(fields));
        allowed.addAll(java.util.Arrays.asList("page", "limit", "sidx", "order"));
        Map<String,Object> result = new java.util.LinkedHashMap<>();
        params.forEach((key, values) -> {
            if (!allowed.contains(key) || values.size() != 1) throw new com.atguigu.common.security.ApiProblem(400, "查询参数不正确或重复");
            result.put(key, values.get(0));
        });
        if (result.containsKey("ware_id")) {
            String legacy = (String)result.remove("ware_id"), current = (String)result.get("wareId");
            if (StringUtils.isNotEmpty(current) && StringUtils.isNotEmpty(legacy) && !current.equals(legacy)) throw new com.atguigu.common.security.ApiProblem(400, "仓库查询条件冲突");
            if (StringUtils.isEmpty(current)) result.put("wareId", legacy);
        }
        return result;
    }

    public IPage<T> getPage(Map<String, Object> params) {
        return this.getPage(params, null, false);
    }

    public IPage<T> getPage(Map<String, Object> params, String defaultOrderField, boolean isAsc) {
        // Pagination parameters
        long curPage = 1;
        long limit = 10;

        if(params.get(Constant.PAGE) != null){
            curPage = Long.parseLong((String)params.get(Constant.PAGE));
        }
        if(params.get(Constant.LIMIT) != null){
            limit = Long.parseLong((String)params.get(Constant.LIMIT));
        }

        // Pagination object
        Page<T> page = new Page<>(curPage, limit);

        // Pagination parameters
        params.put(Constant.PAGE, page);

        // Sort field
        // Prevent SQL injection (sidx and order are concatenated into SQL for sorting, which poses an injection risk)
        String orderField = SQLFilter.sqlInject((String)params.get(Constant.ORDER_FIELD));
        String order = (String)params.get(Constant.ORDER);


        // Frontend field sorting
        if(StringUtils.isNotEmpty(orderField) && StringUtils.isNotEmpty(order)){
            if(Constant.ASC.equalsIgnoreCase(order)) {
                return  page.addOrder(OrderItem.asc(orderField));
            }else {
                return page.addOrder(OrderItem.desc(orderField));
            }
        }

        // No sort field, skip sorting
        if(StringUtils.isBlank(defaultOrderField)){
            return page;
        }

        // Default sorting
        if(isAsc) {
            page.addOrder(OrderItem.asc(defaultOrderField));
        }else {
            page.addOrder(OrderItem.desc(defaultOrderField));
        }

        return page;
    }
}
