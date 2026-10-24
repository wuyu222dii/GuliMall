package com.atguigu.gulimall.product;

import com.atguigu.common.security.ApiProblem;
import com.atguigu.common.utils.R;
import com.atguigu.gulimall.product.dao.SkuInfoDao;
import com.atguigu.gulimall.product.entity.SkuInfoEntity;
import com.atguigu.gulimall.product.entity.SpuInfoEntity;
import com.atguigu.gulimall.product.feign.WareFeignService;
import com.atguigu.gulimall.product.service.*;
import com.atguigu.gulimall.product.service.impl.SkuInfoServiceImpl;
import com.atguigu.gulimall.product.vo.SkuItemVo;
import org.junit.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.apache.ibatis.builder.xml.XMLMapperBuilder;
import org.apache.ibatis.session.Configuration;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import java.io.InputStream;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

public class SkuItemTest {
    @Test
    public void productMappingsParseWithoutDatabase() throws Exception {
        Configuration configuration = new Configuration();
        for (Resource resource : new PathMatchingResourcePatternResolver().getResources("classpath*:mapper/product/*.xml")) {
            try (InputStream input = resource.getInputStream()) {
                new XMLMapperBuilder(input, configuration, resource.toString(), configuration.getSqlFragments()).parse();
            }
        }
    }
    @Test
    public void missingProductIsNotAnAsyncNullPointer() {
        SkuInfoServiceImpl service = new SkuInfoServiceImpl();
        ReflectionTestUtils.setField(service, "baseMapper", mock(SkuInfoDao.class));
        try { service.item(1L); fail("Expected 404"); }
        catch (ApiProblem problem) { assertEquals(404, problem.getStatus()); }
    }

    @Test
    public void failedStockResponseNeverBecomesAvailableStock() {
        SkuInfoServiceImpl service = new SkuInfoServiceImpl();
        SkuInfoDao dao = mock(SkuInfoDao.class);
        ReflectionTestUtils.setField(service, "baseMapper", dao);
        SkuInfoEntity sku = new SkuInfoEntity();
        sku.setSkuId(1L); sku.setSpuId(2L); sku.setCatalogId(3L);
        when(dao.selectById(1L)).thenReturn(sku);
        SpuInfoService spus = mock(SpuInfoService.class);
        SpuInfoEntity spu = new SpuInfoEntity(); spu.setPublishStatus(1);
        when(spus.getById(2L)).thenReturn(spu);
        ReflectionTestUtils.setField(service, "spuInfoService", spus);
        ReflectionTestUtils.setField(service, "skuImagesService", mock(SkuImagesService.class));
        ReflectionTestUtils.setField(service, "skuSaleAttrValueService", mock(SkuSaleAttrValueService.class));
        ReflectionTestUtils.setField(service, "spuInfoDescService", mock(SpuInfoDescService.class));
        ReflectionTestUtils.setField(service, "attrGroupService", mock(AttrGroupService.class));
        WareFeignService ware = mock(WareFeignService.class);
        ReflectionTestUtils.setField(service, "wareFeignService", ware);
        when(ware.getSkuHasStock(anyList())).thenReturn(R.error(503, "Unavailable"));
        SkuItemVo item = service.item(1L);
        assertTrue(item.isOnSale()); assertNull(item.getHasStock());
        when(ware.getSkuHasStock(anyList())).thenThrow(new IllegalStateException("Timeout"));
        assertNull(service.item(1L).getHasStock());
    }
}
