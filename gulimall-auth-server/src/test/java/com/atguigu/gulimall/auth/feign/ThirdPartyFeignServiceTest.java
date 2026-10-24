package com.atguigu.gulimall.auth.feign;

import feign.MethodMetadata;
import org.junit.Test;
import org.springframework.cloud.openfeign.support.SpringMvcContract;

import java.util.Arrays;
import java.util.HashSet;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

public class ThirdPartyFeignServiceTest {
    @Test
    public void smsParametersAreQueryParametersRatherThanMultipleBodies() {
        MethodMetadata method = new SpringMvcContract()
                .parseAndValidatateMetadata(ThirdPartyFeignService.class).get(0);
        assertNull(method.bodyIndex());
        assertEquals(new HashSet<>(Arrays.asList("phone", "code", "minute")), method.template().queries().keySet());
    }
}
