package com.atguigu.common.security;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.io.Serializable;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SessionUser implements Serializable {
    private static final long serialVersionUID = 1L;
    private Long id;
    private String username;
    private boolean admin;
}
