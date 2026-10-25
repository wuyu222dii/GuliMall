package com.atguigu.common.to;
import lombok.Data;
@Data
public class OrderAddressTo {
    private Long id;
    private Long memberId;
    private String name, phone, postCode, province, city, region, detailAddress;
    private Integer defaultStatus;
}
