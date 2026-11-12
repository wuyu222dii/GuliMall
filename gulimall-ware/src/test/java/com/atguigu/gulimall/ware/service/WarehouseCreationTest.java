package com.atguigu.gulimall.ware.service;

import com.atguigu.gulimall.ware.entity.WareInfoEntity;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.Test;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;
import java.util.*;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

public class WarehouseCreationTest {
    private WareInfoEntity request() {WareInfoEntity value=new WareInfoEntity();value.setCreationRequestId(UUID.randomUUID().toString());value.setName(" 仓库 ");value.setAddress(" 本地地址 ");return value;}
    @Test public void canonicalHashUsesNormalizedBusinessValuesAndSeparatesEmbeddedNewlines() {
        WareInfoEntity input=request(),value=WarehouseCreationService.validated(input); String original=WarehouseCreationService.digest(value);
        input.setId(99L); input.setCreationRequestId(UUID.randomUUID().toString()); input.setName("仓库"); input.setAddress("本地地址"); input.setAreacode(""); assertEquals(original,WarehouseCreationService.digest(WarehouseCreationService.validated(input)));
        value.setName("a\nb"); value.setAddress("c"); String first=WarehouseCreationService.digest(value); value.setName("a"); value.setAddress("b\nc"); assertNotEquals(first,WarehouseCreationService.digest(value));
    }
    @Test public void requestIdentifierIsWriteOnlyAndUpdatesCannotCarryIt() throws Exception {
        ObjectMapper mapper=new ObjectMapper(); WareInfoEntity value=mapper.readValue("{\"name\":\"仓库\",\"address\":\"地址\",\"creationRequestId\":\"request\"}",WareInfoEntity.class);
        assertEquals("request",value.getCreationRequestId()); assertFalse(mapper.writeValueAsString(value).contains("creationRequestId")); assertNull(WarehouseCreationService.validated(value).getCreationRequestId());
    }
    @Test public void uniqueWinnerIsReadAfterRollbackAndNotReturnedFromAFailedTransaction() {
        WareInfoEntity request=request(); WareInfoService warehouses=mock(WareInfoService.class); JdbcTemplate db=mock(JdbcTemplate.class); PlatformTransactionManager manager=mock(PlatformTransactionManager.class);
        when(manager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        when(warehouses.save(any(WareInfoEntity.class))).thenAnswer(call->{((WareInfoEntity)call.getArgument(0)).setId(12L);return true;});
        Map<String,Object> winner=new HashMap<>();winner.put("id",11L);winner.put("creation_request_hash",WarehouseCreationService.digest(WarehouseCreationService.validated(request)));
        when(db.queryForList(anyString(),eq(request.getCreationRequestId()))).thenReturn(Collections.emptyList()).thenAnswer(call->{verify(manager).rollback(any());return Collections.singletonList(winner);});
        when(db.update(anyString(),eq(request.getCreationRequestId()),anyString(),eq(12L))).thenThrow(new DuplicateKeyException("concurrent request"));
        assertEquals(Long.valueOf(11),new WarehouseCreationService(warehouses,db,manager).save(request));verify(manager,never()).commit(any());
    }
    @Test public void metadataFailureRollsBackWarehouseAndNeverReportsSuccess() {
        WareInfoEntity request=request();WareInfoService warehouses=mock(WareInfoService.class);JdbcTemplate db=mock(JdbcTemplate.class);PlatformTransactionManager manager=mock(PlatformTransactionManager.class);
        when(manager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());when(db.queryForList(anyString(),eq(request.getCreationRequestId()))).thenReturn(Collections.emptyList());
        when(warehouses.save(any(WareInfoEntity.class))).thenAnswer(call->{((WareInfoEntity)call.getArgument(0)).setId(12L);return true;});when(db.update(anyString(),eq(request.getCreationRequestId()),anyString(),eq(12L))).thenThrow(new DataAccessResourceFailureException("metadata unavailable"));
        try {new WarehouseCreationService(warehouses,db,manager).save(request);fail("Storage failure must propagate");}
        catch(DataAccessResourceFailureException expected){verify(manager).rollback(any());verify(manager,never()).commit(any());}
    }
}
