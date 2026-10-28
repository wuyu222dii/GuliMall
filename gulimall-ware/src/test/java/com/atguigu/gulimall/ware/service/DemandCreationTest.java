package com.atguigu.gulimall.ware.service;

import com.atguigu.gulimall.ware.entity.PurchaseDetailEntity;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.Test;
import java.math.BigDecimal;
import static org.junit.Assert.*;

public class DemandCreationTest {
    @Test public void canonicalAmountAndOriginalBusinessFields() {
        PurchaseDetailEntity value = new PurchaseDetailEntity(); value.setSkuId(1L); value.setWareId(2L); value.setSkuNum(3); value.setSkuPrice(new BigDecimal("4"));
        String hash = DemandCreationService.digest(value);
        value.setSkuPrice(new BigDecimal("4.00")); assertEquals(hash, DemandCreationService.digest(value));
        value.setSkuNum(4); assertNotEquals(hash, DemandCreationService.digest(value));
    }
    @Test public void clientsCannotWriteDeletionOrInternalHash() throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        PurchaseDetailEntity value = mapper.readValue("{\"deleted\":1,\"creationRequestHash\":\"forged\",\"creationRequestId\":\"request\"}", PurchaseDetailEntity.class);
        assertEquals(Integer.valueOf(0), value.getDeleted()); assertNull(value.getCreationRequestHash()); assertEquals("request", value.getCreationRequestId());
        String response = mapper.writeValueAsString(value);
        assertFalse(response.contains("creationRequest")); assertFalse(response.contains("deleted"));
    }
}
