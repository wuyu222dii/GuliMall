package com.atguigu.gulimall.cart;
import com.atguigu.common.security.ApiProblem;
import com.atguigu.common.to.CartProductTo;
import com.atguigu.common.utils.R;
import com.atguigu.gulimall.cart.feign.ProductFeignService;
import com.atguigu.gulimall.cart.service.CartService;
import com.atguigu.gulimall.cart.vo.*;
import org.junit.Test;
import org.springframework.test.util.ReflectionTestUtils;
import java.math.BigDecimal;
import java.util.*;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
public class CartServiceTest {
    private CartInput line(long id,int count,boolean checked) { CartInput value=new CartInput();value.setSkuId(id);value.setCount(count);value.setChecked(checked);return value; }
    @Test public void duplicateGuestSkusNormalizeWithoutChangingTheOriginal() {
        CartMerge request=new CartMerge(); request.setMergeId(UUID.randomUUID().toString()); request.setItems(Arrays.asList(line(Long.MAX_VALUE,2,false),line(Long.MAX_VALUE,3,true)));
        List<CartInput> normalized=CartService.normalize(request);
        assertEquals(1,normalized.size());assertEquals(Integer.valueOf(5),normalized.get(0).getCount());assertTrue(normalized.get(0).getChecked());assertEquals(Integer.valueOf(2),request.getItems().get(0).getCount());
        request.setItems(Arrays.asList(line(1,999,true),line(1,1,true)));
        try { CartService.normalize(request);fail(); } catch(ApiProblem e){assertEquals(400,e.getStatus());}
    }
    @Test public void totalsUseOnlyCheckedItemsAndTrustedFreshPrices() {
        CartService service=new CartService();ProductFeignService products=mock(ProductFeignService.class);ReflectionTestUtils.setField(service,"products",products);
        CartProductTo a=new CartProductTo();a.setSkuId(1L);a.setSkuName("Fresh name");a.setPrice(new BigDecimal("0.10"));a.setOnSale(true);a.setHasStock(true);
        CartProductTo b=new CartProductTo();b.setSkuId(2L);b.setPrice(new BigDecimal("99.00"));b.setOnSale(false);b.setHasStock(true);
        when(products.products(anyList())).thenReturn(R.ok().put("data",Arrays.asList(a,b)));
        CartView view=service.enrich(Arrays.asList(line(1,3,true),line(2,1,false)));
        assertEquals(new BigDecimal("0.30"),view.getTotalAmount());assertEquals("Fresh name",view.getItems().get(0).getSkuName());assertTrue(view.isReadyToCheckout());assertEquals("OFF_SHELF",view.getItems().get(1).getStatus());
        view=service.enrich(Arrays.asList(line(1,3,true),line(2,1,true)));assertFalse(view.isReadyToCheckout());assertNull(view.getTotalAmount());
        a.setPrice(new BigDecimal("-1"));view=service.enrich(Collections.singletonList(line(1,1,true)));assertEquals("PRICE_UNAVAILABLE",view.getItems().get(0).getStatus());assertNull(view.getItems().get(0).getPrice());
    }
    @Test public void productFailureKeepsQuantitiesButMakesPriceAndCheckoutUnavailable() {
        CartService service=new CartService();ProductFeignService products=mock(ProductFeignService.class);ReflectionTestUtils.setField(service,"products",products);
        when(products.products(anyList())).thenThrow(new RuntimeException("Unavailable"));
        CartView view=service.enrich(Collections.singletonList(line(1,4,true)));
        assertEquals(4,view.getTotalCount());assertEquals("SERVICE_UNAVAILABLE",view.getItems().get(0).getStatus());assertNull(view.getItems().get(0).getPrice());assertNull(view.getTotalAmount());assertFalse(view.isReadyToCheckout());
    }
}
