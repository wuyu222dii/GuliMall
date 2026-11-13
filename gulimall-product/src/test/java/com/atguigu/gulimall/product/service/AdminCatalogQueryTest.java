package com.atguigu.gulimall.product.service;

import com.atguigu.common.security.ApiProblem;
import org.junit.Test;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import static org.junit.Assert.*;

public class AdminCatalogQueryTest {
    private MultiValueMap<String,String> params(String... pairs) {
        MultiValueMap<String,String> result=new LinkedMultiValueMap<>();
        for(int i=0;i<pairs.length;i+=2) result.add(pairs[i],pairs[i+1]); return result;
    }
    @Test public void boundsAndKindSpecificFiltersRejectInvalidQueries() {
        assertEquals(20,new AdminCatalogQuery("brands",params()).limit);
        for(String[] pair:new String[][]{{"page","0"},{"page","1000001"},{"limit","101"},{"limit",""},{"status","2"},{"catalogId","-1"},{"key",String.join("",java.util.Collections.nCopies(101,"a"))},{"unknown","1"}}) {
            try { new AdminCatalogQuery("attrs",params(pair)); fail("Invalid query accepted"); } catch(ApiProblem expected) { assertEquals(400,expected.getStatus()); }
        }
        for(String kind:new String[]{"brands","groups","categories"}) {
            try { new AdminCatalogQuery(kind,params("type","1")); fail(); } catch(ApiProblem expected) { }
        }
        try { new AdminCatalogQuery("brands",params("page","1","page","2")); fail(); } catch(ApiProblem expected) { }
    }
    @Test public void literalKeywordsAndFiltersShareOneBoundPredicate() {
        AdminCatalogQuery query=new AdminCatalogQuery("attrs",params("key","red_%!","catalogId","900003","status","0","type","1"));
        com.baomidou.mybatisplus.core.conditions.query.QueryWrapper<Object> where=query.conditions(false);
        String sql=where.getSqlSegment(); assertTrue(sql.contains("attr_name LIKE")); assertTrue(sql.contains("catelog_id")); assertTrue(sql.contains("enable")); assertTrue(sql.contains("attr_type"));
        assertTrue(where.getParamNameValuePairs().containsValue("%red!_!%!!%")); assertFalse(sql.contains("red_"));
        assertNull(query.conditions(true).getSqlSegment());
        assertTrue(new AdminCatalogQuery("brands",params("key","900001")).conditions(false).getSqlSegment().contains("brand_id"));
    }
}
