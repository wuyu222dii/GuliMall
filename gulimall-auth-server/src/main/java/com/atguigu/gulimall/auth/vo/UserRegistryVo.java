package com.atguigu.gulimall.auth.vo;

import lombok.Data;
import org.hibernate.validator.constraints.Length;

import javax.validation.constraints.NotEmpty;
import javax.validation.constraints.Pattern;

@Data
public class UserRegistryVo {

    @NotEmpty(message = "Username is required")
    @Length(min = 6, max = 18, message = "Username must be 6-18 characters")
    private String userName;

    @NotEmpty(message = "Password is required")
    @Length(min = 6, max = 18, message = "Password must be 6-18 characters")
    private String password;

    @NotEmpty(message = "Phone number is required")
    @Pattern(regexp = "^[1]([3-9])[0-9]{9}$", message = "Invalid phone number format")
    private String phone;

    @NotEmpty(message = "Verification code is required")
    private String code;

}
