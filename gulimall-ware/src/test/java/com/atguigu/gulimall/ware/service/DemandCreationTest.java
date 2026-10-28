package com.atguigu.gulimall.ware.service;

import com.atguigu.gulimall.ware.entity.PurchaseDetailEntity;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;
import java.util.*;
import java.math.BigDecimal;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

public class DemandCreationTest {
    @Test public void duplicateWinnerIsReadAfterRollback() {
        PurchaseDetailEntity request = request();
        PurchaseDetailService details = mock(PurchaseDetailService.class); JdbcTemplate db = mock(JdbcTemplate.class);
        PlatformTransactionManager manager = mock(PlatformTransactionManager.class);
        when(manager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        when(details.saveDemand(request)).thenReturn(12L);
        Map<String,Object> winner = new HashMap<>(); winner.put("id", 11L); winner.put("deleted", 0); winner.put("creation_request_hash", DemandCreationService.digest(request));
        when(db.queryForList(anyString(), eq(request.getCreationRequestId()))).thenReturn(Collections.emptyList()).thenAnswer(call -> {
            verify(manager).rollback(any()); return Collections.singletonList(winner);
        });
        when(db.update(anyString(), eq(request.getCreationRequestId()), anyString(), eq(12L))).thenThrow(new DuplicateKeyException("concurrent request"));
        assertEquals(Long.valueOf(11), new DemandCreationService(details, db, manager).save(request));
        verify(manager, never()).commit(any());
    }
    @Test public void metadataFailureRollsBackAndDoesNotReturnSuccess() {
        PurchaseDetailEntity request = request();
        PurchaseDetailService details = mock(PurchaseDetailService.class); JdbcTemplate db = mock(JdbcTemplate.class);
        PlatformTransactionManager manager = mock(PlatformTransactionManager.class);
        when(manager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        when(db.queryForList(anyString(), eq(request.getCreationRequestId()))).thenReturn(Collections.emptyList());
        when(details.saveDemand(request)).thenReturn(12L);
        when(db.update(anyString(), eq(request.getCreationRequestId()), anyString(), eq(12L))).thenThrow(new DataAccessResourceFailureException("storage unavailable"));
        try { new DemandCreationService(details, db, manager).save(request); fail("Failure must propagate"); }
        catch (DataAccessResourceFailureException expected) { verify(manager).rollback(any()); verify(manager, never()).commit(any()); }
    }
    private PurchaseDetailEntity request() {
        PurchaseDetailEntity value = new PurchaseDetailEntity(); value.setCreationRequestId(UUID.randomUUID().toString()); value.setSkuId(1L); value.setWareId(2L); value.setSkuNum(3); value.setSkuPrice(new BigDecimal("4")); return value;
    }
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
