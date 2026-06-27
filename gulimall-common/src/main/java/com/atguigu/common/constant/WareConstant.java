package com.atguigu.common.constant;

public class WareConstant {

    public enum PurchaseStatusEnum {
        CREATED(0, "Created"), ASSIGNED(1, "Assigned"),
        RECEIVE(2, "Received"), FINISH(3, "Completed"),
        HASERROR(4, "Has error");

        private int code;
        private String msg;

        PurchaseStatusEnum(int code, String msg) {
            this.code = code;
            this.msg = msg;
        }

        public int getCode() {
            return code;
        }

        public String getMsg() {
            return msg;
        }
    }


    public enum PurchaseDetailStatusEnum {
        CREATED(0, "Created"), ASSIGNED(1, "Assigned"),
        BUYING(2, "Purchasing"), FINISH(3, "Completed"),
        FAILURE(4, "Purchase failed");

        private int code;
        private String msg;

        PurchaseDetailStatusEnum(int code, String msg) {
            this.code = code;
            this.msg = msg;
        }

        public int getCode() {
            return code;
        }

        public String getMsg() {
            return msg;
        }
    }
}
