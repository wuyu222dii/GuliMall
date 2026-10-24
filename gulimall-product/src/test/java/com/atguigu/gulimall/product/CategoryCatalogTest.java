package com.atguigu.gulimall.product;

import com.atguigu.gulimall.product.dao.CategoryDao;
import com.atguigu.gulimall.product.entity.CategoryEntity;
import com.atguigu.gulimall.product.service.impl.CategoryServiceImpl;
import com.atguigu.gulimall.product.vo.Catelog2Vo;
import org.junit.Test;
import org.springframework.test.util.ReflectionTestUtils;
import java.util.*;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

public class CategoryCatalogTest {
    @Test
    public void largeCategoryIdsAndEmptyRootsProduceAValidCatalog() {
        CategoryDao dao = mock(CategoryDao.class);
        when(dao.selectList(null)).thenReturn(Arrays.asList(category(900001L, 0L),
                category(900002L, 900001L), category(900003L, 900002L), category(900010L, 0L)));
        CategoryServiceImpl service = new CategoryServiceImpl();
        ReflectionTestUtils.setField(service, "baseMapper", dao);
        Map<String,List<Catelog2Vo>> catalog = service.getCatalogJson();
        assertEquals("900002", catalog.get("900001").get(0).getId());
        assertEquals("900003", catalog.get("900001").get(0).getCatalog3List().get(0).getId());
        assertTrue(catalog.get("900010").isEmpty());
    }
    private CategoryEntity category(Long id, Long parent) {
        CategoryEntity entity = new CategoryEntity();
        entity.setCatId(id); entity.setParentCid(parent); entity.setName("Demo");
        return entity;
    }
}
