package com.atguigu.gulimall.search.service.impl;
import com.alibaba.fastjson.JSONObject;
import com.atguigu.common.security.ApiProblem;
import com.atguigu.common.utils.PageUtils;
import com.atguigu.gulimall.search.constant.EsConstant;
import com.atguigu.gulimall.search.service.MallSearchService;
import com.atguigu.gulimall.search.vo.SearchParam;
import org.apache.lucene.search.join.ScoreMode;
import org.elasticsearch.index.query.*;
import org.elasticsearch.search.builder.SearchSourceBuilder;
import org.elasticsearch.search.sort.SortOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.*;
@Service
public class MallSearchServiceImpl implements MallSearchService {
    @Autowired private ProductSaveServiceImpl elastic;
    public SearchSourceBuilder build(SearchParam p) {
        p.validate();
        BoolQueryBuilder query = QueryBuilders.boolQuery();
        if (!p.getKeyword().isEmpty()) {
            BoolQueryBuilder text = QueryBuilders.boolQuery().should(QueryBuilders.multiMatchQuery(p.getKeyword(), "skuTitle", "skuName"));
            if (p.getKeyword().matches("[0-9]{1,18}")) text.should(QueryBuilders.termQuery("skuId", Long.valueOf(p.getKeyword())));
            query.must(text.minimumShouldMatch(1));
        }
        if (p.getCatalogId() != null && p.getCatalogId() > 0) query.filter(QueryBuilders.termQuery("catalogId", p.getCatalogId()));
        if (p.getBrandId() != null && !p.getBrandId().isEmpty()) query.filter(QueryBuilders.termsQuery("brandId", p.getBrandId()));
        if (p.getHasStock() != null) query.filter(QueryBuilders.termQuery("hasStock", p.getHasStock() == 1));
        RangeQueryBuilder price = QueryBuilders.rangeQuery("skuPrice");
        if (p.getMin() != null) price.gte(p.getMin());
        if (p.getMax() != null) price.lte(p.getMax());
        if (p.getMin() != null || p.getMax() != null) query.filter(price);
        if (p.getAttrs() != null) for (String attr : p.getAttrs()) {
            int split = attr.indexOf('_');
            query.filter(QueryBuilders.nestedQuery("attrs", QueryBuilders.boolQuery().filter(QueryBuilders.termQuery("attrs.attrId", Long.valueOf(attr.substring(0, split))))
                .filter(QueryBuilders.termQuery("attrs.attrValue", attr.substring(split + 1))), ScoreMode.None));
        }
        SearchSourceBuilder source = new SearchSourceBuilder().query(query).trackTotalHits(true).from((p.getPage()-1)*p.getLimit()).size(p.getLimit());
        if (!"default".equals(p.getSort())) source.sort("skuPrice", "price_asc".equals(p.getSort()) ? SortOrder.ASC : SortOrder.DESC);
        else source.sort("_score", SortOrder.DESC);
        return source.sort("skuId", SortOrder.ASC);
    }
    @Override public PageUtils search(SearchParam p) {
        JSONObject response = elastic.request("POST", "/" + EsConstant.PRODUCT_INDEX + "/_search", build(p).toString());
        if (response.getBooleanValue("timed_out") || response.getJSONObject("_shards").getIntValue("failed") > 0) throw new ApiProblem(503, "搜索未完整执行，请稍后重试");
        List<Map<String,Object>> list = new ArrayList<>();
        JSONObject hits = response.getJSONObject("hits");
        for (Object hit : hits.getJSONArray("hits")) {
            JSONObject sku = ((JSONObject)hit).getJSONObject("_source");
            Map<String,Object> card = new LinkedHashMap<>(sku);
            card.put("price", sku.getBigDecimal("skuPrice")); card.put("skuDefaultImg", sku.getString("skuImg")); list.add(card);
        }
        return new PageUtils(list, hits.getJSONObject("total").getIntValue("value"), p.getLimit(), p.getPage());
    }
}
