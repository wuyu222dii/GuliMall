package com.atguigu.common.security;

import lombok.Data;
import lombok.ToString;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Pattern;
import javax.validation.constraints.Size;

@Data
public class RegistrationRequest {
    @NotBlank @Pattern(regexp = "[A-Za-z_][A-Za-z0-9_]{5,17}")
    private String username;
    @NotBlank @Size(min = 8, max = 64) @ToString.Exclude
    private String password;
    @NotBlank @Pattern(regexp = "1[3-9][0-9]{9}")
    private String phone;
    @NotBlank @Pattern(regexp = "[0-9]{6}") @ToString.Exclude
    private String code;
}
