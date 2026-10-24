package com.atguigu.gulimall.auth;

import com.atguigu.common.security.ApiProblem;
import com.atguigu.gulimall.auth.service.VerificationCodeService;
import org.junit.Test;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.Assert.*;

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
}
