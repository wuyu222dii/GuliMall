package com.atguigu.gulimall.cart.service;

import com.alibaba.fastjson.JSON;
import com.atguigu.common.security.ApiProblem;
import com.atguigu.gulimall.cart.feign.ProductFeignService;
import com.atguigu.gulimall.cart.vo.CartInput;
import org.junit.Test;
import org.springframework.data.redis.core.HashOperations;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.test.util.ReflectionTestUtils;
import java.util.*;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

public class AddReceiptTest {
    private CartInput input() { CartInput value=new CartInput(); value.setSkuId(Long.MAX_VALUE); value.setCount(2); value.setRequestId(UUID.randomUUID().toString()); return value; }
    @Test public void originalHashBindsOnlySkuAndIncrement() {
        CartInput value=input(); String digest=CartService.additionDigest(value); assertTrue(digest.matches("[a-f0-9]{64}"));
        value.setChecked(false); value.setRevision("client cannot choose a version"); value.setRequestId(UUID.randomUUID().toString()); assertEquals(digest,CartService.additionDigest(value));
        value.setCount(3); assertNotEquals(digest,CartService.additionDigest(value)); value.setCount(2); value.setSkuId(1L); assertNotEquals(digest,CartService.additionDigest(value));
    }
    @Test public void committedReceiptReturnsBeforeAnyProductOrCartWriteAndHidesItsHash() {
        CartService service=new CartService(); StringRedisTemplate redis=mock(StringRedisTemplate.class); HashOperations hashes=mock(HashOperations.class); ProductFeignService products=mock(ProductFeignService.class);
        ReflectionTestUtils.setField(service,"redis",redis); ReflectionTestUtils.setField(service,"products",products); when(redis.opsForHash()).thenReturn(hashes);
        CartInput value=input(); Map<String,Object> receipt=new LinkedHashMap<>(); receipt.put("hash",CartService.additionDigest(value)); receipt.put("skuId",value.getSkuId().toString()); receipt.put("count",2);
        when(hashes.get("gulimall:cart:{1}:adds",value.getRequestId())).thenReturn(JSON.toJSONString(receipt));
        service.add(1,value); verifyZeroInteractions(products); verify(redis,never()).execute(org.mockito.ArgumentMatchers.any(org.springframework.data.redis.core.script.RedisScript.class),org.mockito.ArgumentMatchers.anyList(),org.mockito.ArgumentMatchers.any(Object[].class));
        Map<String,Object> response=service.addition(1,value.getRequestId()); assertEquals(new HashSet<>(Arrays.asList("executed","skuId","count")),response.keySet()); assertEquals(Long.MAX_VALUE,response.get("skuId"));
        value.setCount(3); try { service.add(1,value); fail(); } catch(ApiProblem expected) { assertEquals(409,expected.getStatus()); }
    }
    @Test public void missingAndMalformedReceiptsAreDifferentFromEachOther() {
        CartService service=new CartService(); StringRedisTemplate redis=mock(StringRedisTemplate.class); HashOperations hashes=mock(HashOperations.class);
        ReflectionTestUtils.setField(service,"redis",redis); when(redis.opsForHash()).thenReturn(hashes); String id=UUID.randomUUID().toString();
        assertEquals(Collections.singletonMap("executed",false),service.addition(1,id));
        when(hashes.get("gulimall:cart:{1}:adds",id)).thenReturn("{broken"); try { service.addition(1,id);fail(); } catch(ApiProblem expected) { assertEquals(503,expected.getStatus()); }
        try { service.addition(1,"A"+id.substring(1)); fail(); } catch(ApiProblem expected) { assertEquals(400,expected.getStatus()); }
    }
}
