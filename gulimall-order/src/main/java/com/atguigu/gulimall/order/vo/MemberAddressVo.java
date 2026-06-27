package com.atguigu.gulimall.order.vo;

import lombok.Data;

/**
 * Shipping address
 */
@Data
public class MemberAddressVo {
    private Long id;
    /**
     * member_id
     */
    private Long memberId;
    /**
     * Receiver name
     */
    private String name;
    /**
     * Phone
     */
    private String phone;
    /**
     * Postal code
     */
    private String postCode;
    /**
     * Province/municipality
     */
    private String province;
    /**
     * City
     */
    private String city;
    /**
     * District
     */
    private String region;
    /**
     * Detailed address (street)
     */
    private String detailAddress;
    /**
     * Province/city/district code
     */
    private String areacode;
    /**
     * Is default
     */
    private Integer defaultStatus;
}
