package com.atguigu.gulimall.member;

import com.atguigu.common.security.*;
import com.atguigu.gulimall.member.dao.MemberDao;
import com.atguigu.gulimall.member.entity.MemberEntity;
import com.atguigu.gulimall.member.service.impl.MemberServiceImpl;
import org.junit.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import com.fasterxml.jackson.databind.ObjectMapper;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

public class MemberIdentityTest {
    @Test
    public void registrationStoresBcryptAndDoesNotSerializeTheHash() throws Exception {
        MemberDao dao = mock(MemberDao.class);
        when(dao.insert(any(MemberEntity.class))).thenAnswer(call -> {
            ((MemberEntity) call.getArgument(0)).setId(123L);
            return 1;
        });
        MemberServiceImpl service = new MemberServiceImpl();
        ReflectionTestUtils.setField(service, "baseMapper", dao);
        RegistrationRequest request = new RegistrationRequest();
        request.setUsername("test_member"); request.setPhone("13900000003"); request.setPassword("Test12345!");
        SessionUser user = service.register(request);
        ArgumentCaptor<MemberEntity> stored = ArgumentCaptor.forClass(MemberEntity.class);
        verify(dao).insert(stored.capture());
        assertTrue(new BCryptPasswordEncoder().matches(request.getPassword(), stored.getValue().getPassword()));
        assertFalse(new ObjectMapper().writeValueAsString(stored.getValue()).contains("password"));
        assertEquals(Long.valueOf(123), user.getId());
        assertFalse(user.isAdmin());
    }
    @Test
    public void bcryptByteLimitIsValidatedBeforeWriting() {
        MemberDao dao = mock(MemberDao.class);
        MemberServiceImpl service = new MemberServiceImpl();
        ReflectionTestUtils.setField(service, "baseMapper", dao);
        RegistrationRequest request = new RegistrationRequest();
        request.setPassword(String.join("", java.util.Collections.nCopies(25, "密")));
        try { service.register(request); fail("Expected rejection"); }
        catch (ApiProblem e) { assertEquals(400, e.getStatus()); }
        verifyZeroInteractions(dao);
    }
}
