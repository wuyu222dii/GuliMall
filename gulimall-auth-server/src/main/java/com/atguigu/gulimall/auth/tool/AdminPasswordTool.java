package com.atguigu.gulimall.auth.tool;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import java.io.Console;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;

public class AdminPasswordTool {
    public static String hash(String password) {
        if(password==null || password.length()<6 || password.length()>64 || password.getBytes(StandardCharsets.UTF_8).length>72) throw new IllegalArgumentException("Use 6-64 characters and at most 72 UTF-8 bytes");
        return new BCryptPasswordEncoder().encode(password);
    }
    public static void main(String[] args) {
        if(args.length!=0) throw new IllegalArgumentException("Passwords must not be supplied as arguments");
        Console console=System.console();
        if(console==null) throw new IllegalStateException("Open an interactive terminal to enter a password without echo");
        char[] password=console.readPassword("Admin password: "),confirmation=console.readPassword("Confirm password: ");
        try {
            if(password==null || confirmation==null || !Arrays.equals(password,confirmation)) throw new IllegalArgumentException("Passwords do not match");
            System.out.println(hash(new String(password)));
        } finally {if(password!=null)Arrays.fill(password,'\0');if(confirmation!=null)Arrays.fill(confirmation,'\0');}
    }
}
