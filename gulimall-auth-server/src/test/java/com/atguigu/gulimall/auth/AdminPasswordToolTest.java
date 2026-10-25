package com.atguigu.gulimall.auth;

import com.atguigu.gulimall.auth.tool.AdminPasswordTool;
import org.junit.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import static org.junit.Assert.*;

public class AdminPasswordToolTest {
    @Test public void hashesWithExistingBcryptAndRejectsUnsafeInputsAndCommandArguments() {
        String password="Local_admin_test!",hash=AdminPasswordTool.hash(password);
        assertTrue(new BCryptPasswordEncoder().matches(password,hash));assertNotEquals(password,hash);
        for(String value:new String[]{null,"12345",String.join("",java.util.Collections.nCopies(25,"字"))}) {
            try{AdminPasswordTool.hash(value);fail("Invalid password accepted");}catch(IllegalArgumentException expected){assertTrue(expected.getMessage().contains("72"));}
        }
        try{AdminPasswordTool.main(new String[]{password});fail("Argument accepted");}catch(IllegalArgumentException expected){assertFalse(expected.getMessage().contains(password));}
    }
}
