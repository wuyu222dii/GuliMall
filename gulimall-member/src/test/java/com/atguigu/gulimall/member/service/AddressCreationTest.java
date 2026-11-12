package com.atguigu.gulimall.member.service;

import com.atguigu.gulimall.member.entity.MemberReceiveAddressEntity;
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

public class AddressCreationTest {
    private MemberReceiveAddressEntity request() {
        MemberReceiveAddressEntity value=new MemberReceiveAddressEntity(); value.setCreationRequestId(UUID.randomUUID().toString()); value.setName("收件人"); value.setPhone("13800000001"); value.setProvince("省"); value.setCity("市"); value.setDetailAddress("街道"); value.setDefaultStatus(1); return value;
    }
    @Test public void originalBusinessHashExcludesIdentityAndSeparatesEmbeddedNewlines() {
        MemberReceiveAddressEntity value=request(); String original=MemberAddressService.digest(value);
        value.setId(99L); value.setMemberId(88L); value.setCreationRequestId(UUID.randomUUID().toString()); assertEquals(original,MemberAddressService.digest(value));
        value.setDefaultStatus(null); String unset=MemberAddressService.digest(value); value.setDefaultStatus(0); assertEquals(unset,MemberAddressService.digest(value)); assertNotEquals(original,unset);
        value.setProvince("a\nb"); value.setCity("c"); String first=MemberAddressService.digest(value);
        value.setProvince("a"); value.setCity("b\nc"); assertNotEquals(first,MemberAddressService.digest(value));
        String before=MemberAddressService.digest(value); value.setPostCode("100001"); assertNotEquals(before,MemberAddressService.digest(value));
    }
    @Test public void requestIdentifierIsAcceptedButNotReturned() throws Exception {
        ObjectMapper mapper=new ObjectMapper(); MemberReceiveAddressEntity value=mapper.readValue("{\"creationRequestId\":\"request\"}",MemberReceiveAddressEntity.class);
        assertEquals("request",value.getCreationRequestId()); assertFalse(mapper.writeValueAsString(value).contains("creationRequestId"));
    }
    @Test public void uniqueWinnerIsReadOnlyAfterTheEntireLosingTransactionRollsBack() {
        MemberReceiveAddressEntity request=request(); MemberReceiveAddressService addresses=mock(MemberReceiveAddressService.class); JdbcTemplate db=mock(JdbcTemplate.class); PlatformTransactionManager manager=mock(PlatformTransactionManager.class);
        when(manager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        when(db.queryForList(contains("FOR UPDATE"),eq(1L))).thenReturn(Collections.singletonList(Collections.singletonMap("id",1L)));
        when(addresses.saveOrUpdate(any(MemberReceiveAddressEntity.class))).thenAnswer(call->{((MemberReceiveAddressEntity)call.getArgument(0)).setId(12L);return true;});
        Map<String,Object> winner=new HashMap<>(); winner.put("address_id",11L); winner.put("present_id",11L); winner.put("creation_request_hash",MemberAddressService.digest(request));
        when(db.queryForList(contains("LEFT JOIN"),eq(1L),eq(request.getCreationRequestId()))).thenReturn(Collections.emptyList()).thenAnswer(call->{verify(manager).rollback(any());return Collections.singletonList(winner);});
        when(db.update(startsWith("INSERT INTO ums_address_creation_receipt"),eq(1L),eq(request.getCreationRequestId()),anyString(),eq(12L))).thenThrow(new DuplicateKeyException("concurrent receipt"));
        assertEquals(Long.valueOf(11),new MemberAddressService(addresses,db,manager).save(null,request,1L)); verify(manager,never()).commit(any());
    }
    @Test public void receiptWriteFailureRollsBackAddressAndDefaultChanges() {
        MemberReceiveAddressEntity request=request(); MemberReceiveAddressService addresses=mock(MemberReceiveAddressService.class); JdbcTemplate db=mock(JdbcTemplate.class); PlatformTransactionManager manager=mock(PlatformTransactionManager.class);
        when(manager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        when(db.queryForList(contains("FOR UPDATE"),eq(1L))).thenReturn(Collections.singletonList(Collections.singletonMap("id",1L)));
        when(db.queryForList(contains("LEFT JOIN"),eq(1L),eq(request.getCreationRequestId()))).thenReturn(Collections.emptyList());
        when(addresses.saveOrUpdate(any(MemberReceiveAddressEntity.class))).thenAnswer(call->{((MemberReceiveAddressEntity)call.getArgument(0)).setId(12L);return true;});
        when(db.update(startsWith("INSERT INTO ums_address_creation_receipt"),eq(1L),eq(request.getCreationRequestId()),anyString(),eq(12L))).thenThrow(new DataAccessResourceFailureException("receipt unavailable"));
        try {new MemberAddressService(addresses,db,manager).save(null,request,1L);fail("Storage failure must propagate");}
        catch(DataAccessResourceFailureException expected){verify(manager).rollback(any());verify(manager,never()).commit(any());}
    }
}
