package com.atguigu.common.exception;

public enum BizCodeEnume {
    UNKNOWN_EXCEPTION(10000, "Unknown system exception"),
    VALID_EXCEPTION(10001, "Parameter validation failed"),
    SMS_CODE_EXCEPTION(10002, "Verification code request rate too high, please try again later"),
    PRODUCT_UP_EXCEPTION(11000, "Product listing exception");

    private Integer code;
    private String msg;

    BizCodeEnume(Integer code, String msg) {
        this.code = code;
        this.msg = msg;
    }

    public Integer getCode() {
        return code;
    }

    public String getMsg() {
        return msg;
    }

}
