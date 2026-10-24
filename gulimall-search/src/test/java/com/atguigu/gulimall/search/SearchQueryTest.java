package com.atguigu.gulimall.search;
import com.alibaba.fastjson.JSON;
import com.atguigu.common.security.ApiProblem;
import com.atguigu.common.utils.PageUtils;
import com.atguigu.gulimall.search.service.impl.*;
import com.atguigu.gulimall.search.vo.SearchParam;
import org.junit.Test;
import org.springframework.test.util.ReflectionTestUtils;
import java.math.BigDecimal;
import java.util.Arrays;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
public class SearchQueryTest {
    @Test public void zeroMaximumAndNestedAttributePairsRemainFilters() {
        SearchParam p = new SearchParam(); p.setMax(BigDecimal.ZERO); p.setAttrs(Arrays.asList("1_8GB", "2_Red"));
        String query = new MallSearchServiceImpl().build(p).toString();
        assertTrue(query.contains("\"to\":0")); assertEquals(2, query.split("\"nested\"",-1).length-1);
        assertTrue(query.contains("\"skuId\""));
    }
    @Test public void arbitrarySortAndOversizedWindowsAreRejected() {
        SearchParam p = new SearchParam(); p.setSort("password_asc");
        try { p.validate(); fail(); } catch (ApiProblem e) { assertEquals(400,e.getStatus()); }
        p.setSort("default"); p.setPage(1001); p.setLimit(10);
        try { p.validate(); fail(); } catch (ApiProblem e) { assertEquals(400,e.getStatus()); }
    }
    @Test public void executedSearchReturnsPageAndPlainTextTitle() {
        ProductSaveServiceImpl elastic = mock(ProductSaveServiceImpl.class);
        when(elastic.request(anyString(),anyString(),anyString())).thenReturn(JSON.parseObject("{\"_shards\":{\"failed\":0},\"hits\":{\"total\":{\"value\":1},\"hits\":[{\"_source\":{\"skuId\":1,\"skuTitle\":\"Phone\",\"skuPrice\":10,\"skuImg\":\"/demo-product.svg\"}}]}}"));
        MallSearchServiceImpl service = new MallSearchServiceImpl(); ReflectionTestUtils.setField(service,"elastic",elastic);
        PageUtils page = service.search(new SearchParam()); assertEquals(1,page.getTotalCount()); assertEquals(1,page.getList().size());
    }
}
