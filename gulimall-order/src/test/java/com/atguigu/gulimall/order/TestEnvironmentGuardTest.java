package com.atguigu.gulimall.order;

import com.atguigu.common.security.TestEnvironmentGuard;
import org.junit.Test;
import org.springframework.mock.env.MockEnvironment;
import static org.junit.Assert.*;

public class TestEnvironmentGuardTest {
    @Test public void testProfileRequiresAnExplicitIsolatedProjectBeforeStartingServices() {
        TestEnvironmentGuard guard=new TestEnvironmentGuard(); MockEnvironment environment=new MockEnvironment();
        environment.setActiveProfiles("dev"); guard.postProcessEnvironment(environment,null);
        environment.setActiveProfiles("test");
        try {guard.postProcessEnvironment(environment,null);fail("Unisolated test started");} catch(IllegalStateException expected) {assertTrue(expected.getMessage().contains("scripts/test.ps1"));}
        environment.withProperty("GULIMALL_TEST","1").withProperty("COMPOSE_PROJECT_NAME","gulimall-demo");
        try {guard.postProcessEnvironment(environment,null);fail("Demo project allowed");} catch(IllegalStateException expected) {assertTrue(expected.getMessage().contains("isolated"));}
        environment.withProperty("COMPOSE_PROJECT_NAME","gulimall-test");guard.postProcessEnvironment(environment,null);
    }
}
