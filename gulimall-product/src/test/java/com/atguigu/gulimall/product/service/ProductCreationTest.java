package com.atguigu.gulimall.product.service;
import com.atguigu.gulimall.product.vo.SpuSaveVo;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.Test;
import static org.junit.Assert.*;
public class ProductCreationTest {
    @Test(expected=com.atguigu.common.security.ApiProblem.class)
    public void rejectsExtremeExponentBeforeExpandingDigestInput()throws Exception {
        ProductCreationService.digest(read("{\"weight\":1e1000000}"));
    }
    private SpuSaveVo read(String json)throws Exception{return new ObjectMapper().readValue(json,SpuSaveVo.class);}
    @Test public void digestNormalizesObjectOrderAndNumericScale()throws Exception {
        assertEquals(ProductCreationService.digest(read("{\"spuName\":\"A\",\"weight\":1.00,\"images\":[\"a\",\"b\"]}")),ProductCreationService.digest(read("{\"images\":[\"a\",\"b\"],\"weight\":1,\"spuName\":\"A\"}")));
    }
    @Test public void digestRetainsArrayOrderAndBusinessValues()throws Exception {
        assertNotEquals(ProductCreationService.digest(read("{\"images\":[\"a\",\"b\"]}")),ProductCreationService.digest(read("{\"images\":[\"b\",\"a\"]}")));
        assertNotEquals(ProductCreationService.digest(read("{\"spuName\":\"A\"}")),ProductCreationService.digest(read("{\"spuName\":\"B\"}")));
    }
    @Test public void ignoresClientNamesAndUnusedMarketingFields()throws Exception {
        assertEquals(ProductCreationService.digest(read("{\"skus\":[{\"price\":10.00,\"attr\":[{\"attrId\":1,\"attrName\":\"ignored\",\"attrValue\":\"red\"}]}]}")),ProductCreationService.digest(read("{\"publishStatus\":1,\"skus\":[{\"price\":10,\"fullCount\":5,\"attr\":[{\"attrId\":1,\"attrValue\":\"red\"}]}]}")));
    }
}
