package com.atguigu.gulimall.auth;

import com.atguigu.common.security.ApiProblem;
import com.atguigu.gulimall.auth.service.VerificationCodeService;
import org.junit.Test;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import com.atguigu.gulimall.auth.service.SmsSender;

public class VerificationCodeServiceTest {
    @Test
    public void developmentCodesRequireBothTheDevProfileAndExplicitMode() {
        StandardEnvironment environment = new StandardEnvironment();
        VerificationCodeService codes = new VerificationCodeService();
        ReflectionTestUtils.setField(codes, "environment", environment);
        ReflectionTestUtils.setField(codes, "mode", "development");
        environment.setActiveProfiles("prod");
        assertDisabled(codes);
        environment.setActiveProfiles("dev", "prod");
        assertDisabled(codes);
        environment.setActiveProfiles("dev");
        ReflectionTestUtils.setField(codes, "mode", "disabled");
        assertDisabled(codes);
    }
    private void assertDisabled(VerificationCodeService codes) {
        try { codes.send("13900000003"); fail("Should reject before touching Redis"); }
        catch (ApiProblem e) { assertEquals(503, e.getStatus()); }
    }
    @Test public void realDeliveryCannotStartAndFailedDeliveryNeverReturnsACode() {
        StandardEnvironment environment=new StandardEnvironment();environment.setActiveProfiles("dev");
        VerificationCodeService codes=new VerificationCodeService();ReflectionTestUtils.setField(codes,"environment",environment);ReflectionTestUtils.setField(codes,"mode","real");
        try{codes.validateMode();fail("Real delivery has no implementation");}catch(IllegalStateException expected){assertTrue(expected.getMessage().contains("not implemented"));}
        ReflectionTestUtils.setField(codes,"mode","development");
        StringRedisTemplate redis=mock(StringRedisTemplate.class);
        doReturn(1L).when(redis).execute(any(DefaultRedisScript.class),anyList(),anyString(),anyString());
        ReflectionTestUtils.setField(codes,"redis",redis);ReflectionTestUtils.setField(codes,"sender",(SmsSender)(phone,code,minutes)->{throw new IllegalStateException("provider failure");});
        codes.validateMode();
        try{codes.send("13900000003");fail("A failed delivery must not return a development code");}catch(ApiProblem expected){assertEquals(503,expected.getStatus());assertFalse(expected.getMessage().contains("provider failure"));}
    }
}
