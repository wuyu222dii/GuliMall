package com.atguigu.common.security;

import lombok.Data;
import lombok.ToString;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;

@Data
public class Credentials {
    @NotBlank @Size(max = 64)
    private String username;
    @NotBlank @Size(max = 64) @ToString.Exclude
    private String password;
}
