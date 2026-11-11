package com.atguigu.gulimall.member;
import com.atguigu.common.security.ApiErrorAdvice;
import com.atguigu.gulimall.member.controller.MemberAddressController;
import org.junit.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
public class AddressQueryTest {
    @Test public void rejectsInvalidAddressQueriesBeforeAccessingStorage() throws Exception {
        MockMvc mvc=MockMvcBuilders.standaloneSetup(new MemberAddressController()).setControllerAdvice(new ApiErrorAdvice()).build();
        for(String query:new String[]{"page=1&page=2","memberId=2","sidx=id","order=desc","page=0","page=01","page=1000001","page=wrong","limit=101"}){
            org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request=get("/member/addresses");
            for(String pair:query.split("&")){String[] field=pair.split("=",2);request.param(field[0],field[1]);}
            mvc.perform(request).andExpect(status().isBadRequest());
        }
    }
}
