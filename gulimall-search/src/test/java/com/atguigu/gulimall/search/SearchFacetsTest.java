package com.atguigu.gulimall.search;
import com.alibaba.fastjson.*;
import com.atguigu.common.security.ApiProblem;
import com.atguigu.common.utils.PageUtils;
import com.atguigu.gulimall.search.service.impl.*;
import com.atguigu.gulimall.search.vo.SearchParam;
import org.junit.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;
import java.util.*;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

public class SearchFacetsTest {
    private JSONObject response(JSONArray buckets) {
        JSONObject result=JSON.parseObject("{\"_shards\":{\"failed\":0},\"hits\":{\"total\":{\"value\":2},\"hits\":[{\"_source\":{\"skuId\":1,\"skuTitle\":\"Phone\",\"skuPrice\":10,\"skuImg\":\"/demo-product.svg\"}}]}}");
        result.put("aggregations",JSON.parseObject("{\"attributes\":{\"ids\":{\"buckets\":[]}}}")); result.getJSONObject("aggregations").getJSONObject("attributes").getJSONObject("ids").put("buckets",buckets);return result;
    }
    private JSONObject bucket(long id,int count) {
        JSONObject bucket=new JSONObject();bucket.put("key",id);bucket.put("names",JSON.parseObject("{\"buckets\":[{\"key\":\"规格\"}]}"));
        JSONArray values=new JSONArray();for(int n=0;n<count;n++){JSONObject value=new JSONObject();value.put("key",n==0?"红,蓝_版本":"值"+n);values.add(value);}JSONObject terms=new JSONObject();terms.put("buckets",values);bucket.put("values",terms);return bucket;
    }
    private MallSearchServiceImpl service(ProductSaveServiceImpl elastic) {MallSearchServiceImpl service=new MallSearchServiceImpl();ReflectionTestUtils.setField(service,"elastic",elastic);return service;}
    @Test public void oneRequestReturnsFullQueryAggregationBesideTheUnchangedPage() {
        ProductSaveServiceImpl elastic=mock(ProductSaveServiceImpl.class);JSONArray buckets=new JSONArray();buckets.add(bucket(1,2));when(elastic.request(anyString(),anyString(),anyString())).thenReturn(response(buckets));
        SearchParam p=new SearchParam();p.setPage(2);p.setLimit(1);p.setAttrs(Arrays.asList("1_红,蓝_版本","1_值1"));
        Map<String,Object> result=service(elastic).searchWithFacets(p);PageUtils page=(PageUtils)result.get("page");assertEquals(2,page.getTotalCount());assertEquals(1,page.getList().size());
        JSONObject facets=JSON.parseObject(JSON.toJSONString(result.get("facets")));assertEquals(2,facets.getJSONArray("attrs").getJSONObject(0).getJSONArray("values").size());
        ArgumentCaptor<String> capture=ArgumentCaptor.forClass(String.class);verify(elastic,times(1)).request(eq("POST"),anyString(),capture.capture());JSONObject source=JSON.parseObject(capture.getValue());assertEquals(1,source.getIntValue("from"));assertEquals(1,source.getIntValue("size"));
        String aggregations=source.getJSONObject("aggregations").toJSONString();assertTrue(aggregations.contains("\"size\":21"));assertTrue(aggregations.contains("\"size\":51"));assertTrue(aggregations.contains("attrs.attrValue"));
        assertEquals(Arrays.asList("1_红,蓝_版本","1_值1"),p.getAttrs());
    }
    @Test public void capsAreExplicitAndLongIdsNeverPassThroughFloatingPoint() {
        ProductSaveServiceImpl elastic=mock(ProductSaveServiceImpl.class);JSONArray buckets=new JSONArray();for(int i=0;i<21;i++)buckets.add(bucket(999999999999999970L+i,51));when(elastic.request(anyString(),anyString(),anyString())).thenReturn(response(buckets));
        JSONObject facets=JSON.parseObject(JSON.toJSONString(service(elastic).searchWithFacets(new SearchParam()).get("facets")));assertTrue(facets.getBooleanValue("attrsTruncated"));assertEquals(20,facets.getJSONArray("attrs").size());
        JSONObject first=facets.getJSONArray("attrs").getJSONObject(0);assertEquals("999999999999999970",first.getString("attrId"));assertEquals(50,first.getJSONArray("values").size());assertTrue(first.getBooleanValue("truncated"));
    }
    @Test public void missingAggregationsAndPartialSearchNeverBecomeSuccessfulEmptyFacets() {
        ProductSaveServiceImpl elastic=mock(ProductSaveServiceImpl.class);MallSearchServiceImpl service=service(elastic);JSONObject valid=response(new JSONArray());
        JSONObject missing=JSON.parseObject(valid.toJSONString());missing.remove("aggregations");JSONObject partial=JSON.parseObject(valid.toJSONString());partial.getJSONObject("_shards").put("failed",1);
        for(JSONObject broken:Arrays.asList(missing,partial)){when(elastic.request(anyString(),anyString(),anyString())).thenReturn(broken);try{service.searchWithFacets(new SearchParam());fail();}catch(ApiProblem expected){assertEquals(503,expected.getStatus());}}
        when(elastic.request(anyString(),anyString(),anyString())).thenReturn(valid);JSONObject facets=JSON.parseObject(JSON.toJSONString(service.searchWithFacets(new SearchParam()).get("facets")));assertTrue(facets.getJSONArray("attrs").isEmpty());assertFalse(facets.getBooleanValue("attrsTruncated"));
    }
}
