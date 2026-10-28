package com.atguigu.gulimall.ware;

import com.atguigu.common.utils.Query;
import com.atguigu.common.security.ApiProblem;
import org.junit.Test;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import static org.junit.Assert.*;

public class QueryParametersTest {
    @Test public void readsSingleValuesAndPreservesWarehouseAlias() {
        MultiValueMap<String,String> values = new LinkedMultiValueMap<>(); values.add("page","2"); values.add("ware_id","3");
        assertEquals("2", Query.singleParameters(values,"wareId","ware_id").get("page"));
        assertEquals("3", Query.singleParameters(values,"wareId","ware_id").get("wareId"));
        values.add("wareId","3"); assertEquals("3", Query.singleParameters(values,"wareId","ware_id").get("wareId"));
    }
    @Test public void rejectsDuplicatesUnknownKeysAndConflictingAliases() {
        for (String query : new String[]{"page=1&page=2", "unknown=x", "wareId=1&ware_id=2"}) {
            MultiValueMap<String,String> values = new LinkedMultiValueMap<>();
            for (String field : query.split("&")) { String[] pair = field.split("="); values.add(pair[0],pair[1]); }
            try { Query.singleParameters(values,"wareId","ware_id"); fail("Ambiguous query accepted"); }
            catch (ApiProblem rejected) { assertEquals(400,rejected.getStatus()); }
        }
    }
}
