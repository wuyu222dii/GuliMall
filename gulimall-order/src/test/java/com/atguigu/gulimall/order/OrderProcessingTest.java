package com.atguigu.gulimall.order;

import com.atguigu.gulimall.order.dao.OrderDao;
import com.atguigu.gulimall.order.entity.OrderEntity;
import com.atguigu.gulimall.order.service.OrderFulfillmentService;
import org.junit.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;
import java.util.*;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

public class OrderProcessingTest {
    @Test public void exposesOnlySafeProcessingFieldsWithoutChangingOrder() {
        OrderFulfillmentService service=new OrderFulfillmentService(); OrderDao dao=mock(OrderDao.class); JdbcTemplate db=mock(JdbcTemplate.class);
        ReflectionTestUtils.setField(service,"orders",dao); ReflectionTestUtils.setField(service,"db",db);
        OrderEntity order=new OrderEntity(); order.setStatus(1); order.setInventoryStatus(0); order.setOrderSn("original"); when(dao.selectById(7L)).thenReturn(order);
        Map<String,Object> raw=new HashMap<>(); raw.put("event_type","STOCK_DEDUCT"); raw.put("attempts",3); raw.put("next_attempt",new Date()); raw.put("last_error","secret-stack-and-token");
        when(db.queryForList(anyString(),eq("original"))).thenReturn(Collections.singletonList(raw));
        Map<String,Object> result=service.processing(7L); assertEquals(false,result.get("fulfillmentReady")); assertEquals(0,result.get("inventoryStatus"));
        assertFalse(result.toString().contains("secret-stack")); assertFalse(result.toString().contains("last_error")); assertTrue(result.toString().contains("errorMessage"));
        assertEquals(Integer.valueOf(1),order.getStatus()); verify(db).queryForList(anyString(),eq("original")); verifyNoMoreInteractions(db);
        raw.put("event_type","CLOSE_TIMER");raw.put("sent_at",new Date());order.setPaymentDeadline(new Date());
        Map<?,?> timer=(Map<?,?>)((List<?>)service.processing(7L).get("events")).get(0);
        assertNull(timer.get("nextAttempt"));assertEquals(order.getPaymentDeadline(),timer.get("scheduledFor"));
    }
}
