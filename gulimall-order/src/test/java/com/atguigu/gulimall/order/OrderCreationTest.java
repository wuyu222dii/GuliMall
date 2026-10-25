package com.atguigu.gulimall.order;
import com.atguigu.common.security.ApiProblem;
import com.atguigu.common.to.OrderLineTo;
import com.atguigu.gulimall.order.service.OrderCreationService;
import org.junit.Test;
import java.math.BigDecimal;
import java.util.*;
import static org.junit.Assert.*;
public class OrderCreationTest {
    @Test public void decimalTotalsRejectInvalidQuantitiesPricesAndDuplicates() {
        OrderLineTo line=new OrderLineTo(); line.setSkuId(1L); line.setCount(3); line.setPrice(new BigDecimal("0.10"));
        assertEquals(new BigDecimal("0.30"),OrderCreationService.total(Collections.singletonList(line)));
        try { OrderCreationService.total(Arrays.asList(line,line)); fail(); } catch(ApiProblem e) { assertEquals(400,e.getStatus()); }
        line.setCount(0); try { OrderCreationService.total(Collections.singletonList(line)); fail(); } catch(ApiProblem e) { assertEquals(400,e.getStatus()); }
        line.setCount(1); line.setPrice(new BigDecimal("-0.01")); try { OrderCreationService.total(Collections.singletonList(line)); fail(); } catch(ApiProblem e) { assertEquals(400,e.getStatus()); }
        line.setPrice(new BigDecimal("0.001")); try { OrderCreationService.total(Collections.singletonList(line)); fail(); } catch(ApiProblem e) { assertEquals(400,e.getStatus()); }
    }
}
