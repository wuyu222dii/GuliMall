package com.atguigu.gulimall.ware;
import com.atguigu.common.security.ApiProblem;
import com.atguigu.common.to.*;
import com.atguigu.gulimall.ware.service.StockReservationService;
import org.junit.Test;
import java.util.*;
import static org.junit.Assert.*;
public class StockReservationTest {
    @Test public void canonicalLockPayloadKeepsLongIdsAndRejectsDuplicateOrInvalidLines() {
        OrderLineTo a=new OrderLineTo(); a.setSkuId(Long.MAX_VALUE); a.setCount(2);
        OrderLineTo b=new OrderLineTo(); b.setSkuId(1L); b.setCount(1);
        StockLockTo request=new StockLockTo(); request.setOrderSn(UUID.randomUUID().toString().replace("-","")); request.setItems(Arrays.asList(a,b));
        String first=StockReservationService.payload(request); request.setItems(Arrays.asList(b,a)); assertEquals(first,StockReservationService.payload(request)); assertTrue(first.contains(Long.toString(Long.MAX_VALUE)));
        request.setItems(Arrays.asList(a,a)); try { StockReservationService.payload(request); fail(); } catch(ApiProblem e) { assertEquals(400,e.getStatus()); }
        request.setItems(Collections.singletonList(b)); b.setCount(0); try { StockReservationService.payload(request); fail(); } catch(ApiProblem e) { assertEquals(400,e.getStatus()); }
    }
}
