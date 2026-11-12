package com.atguigu.gulimall.search;
import com.atguigu.common.security.ApiErrorAdvice;
import com.atguigu.common.utils.PageUtils;
import com.atguigu.gulimall.search.controller.SearchController;
import com.atguigu.gulimall.search.service.MallSearchService;
import com.atguigu.gulimall.search.vo.SearchParam;
import org.junit.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import java.util.*;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

public class SearchParametersTest {
    private MockMvc mvc(MallSearchService service) {
        SearchController controller=new SearchController(); ReflectionTestUtils.setField(controller,"search",service);
        return MockMvcBuilders.standaloneSetup(controller).setControllerAdvice(new ApiErrorAdvice()).build();
    }
    @Test public void preservesListsCommaValuesAndLegacyCategoryAlias() throws Exception {
        MallSearchService service=mock(MallSearchService.class);
        when(service.searchWithFacets(any(SearchParam.class))).thenReturn(Collections.singletonMap("page",new PageUtils(Collections.emptyList(),0,12,1)));
        mvc(service).perform(get("/search").param("catalog3Id","3").param("brandId","1","2,3").param("attrs","1_红,蓝","2_128GB")).andExpect(status().isOk());
        ArgumentCaptor<SearchParam> capture=ArgumentCaptor.forClass(SearchParam.class);verify(service).searchWithFacets(capture.capture());
        assertEquals(Long.valueOf(3),capture.getValue().getCatalogId());assertEquals(Arrays.asList(1L,2L,3L),capture.getValue().getBrandId());assertEquals(Arrays.asList("1_红,蓝","2_128GB"),capture.getValue().getAttrs());
    }
    @Test public void invalidQueryNeverExecutesSearch() throws Exception {
        MallSearchService service=mock(MallSearchService.class);MockMvc mvc=mvc(service);
        for(String query:new String[]{"page=1&page=2","unknown=x","catalogId=1&catalog3Id=2","brandId=0","attrs=wrong","max=1e2","hasStock=2","hasStock=01","page=834","limit=0","sort=bad","sort="}) {
            org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request=get("/search");
            for(String pair:query.split("&")){String[] field=pair.split("=",2);request.param(field[0],field[1]);}
            mvc.perform(request).andExpect(status().isBadRequest());
        }
        verifyZeroInteractions(service);
    }
}
