package com.atguigu.common.security;

public class ApiProblem extends RuntimeException {
    private final int status;
    public ApiProblem(int status, String message) { super(message); this.status = status; }
    public int getStatus() { return status; }
}
