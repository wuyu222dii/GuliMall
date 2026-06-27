package com.atguigu.common.vo;

import lombok.Data;
import lombok.ToString;

import java.io.Serializable;
import java.util.Date;

@ToString
@Data
public class MemberResponseVo implements Serializable {

    private static final long serialVersionUID = 5573669251256409786L;

    private Long id;
    /**
     * Member level id
     */
    private Long levelId;
    /**
     * Username
     */
    private String username;
    /**
     * Password
     */
    private String password;
    /**
     * Nickname
     */
    private String nickname;
    /**
     * Mobile phone number
     */
    private String mobile;
    /**
     * Email
     */
    private String email;
    /**
     * Avatar
     */
    private String header;
    /**
     * Gender
     */
    private Integer gender;
    /**
     * Birthday
     */
    private Date birth;
    /**
     * City
     */
    private String city;
    /**
     * Occupation
     */
    private String job;
    /**
     * Personal signature
     */
    private String sign;
    /**
     * User source
     */
    private Integer sourceType;
    /**
     * Points
     */
    private Integer integration;
    /**
     * Growth value
     */
    private Integer growth;
    /**
     * Enable status
     */
    private Integer status;
    /**
     * Registration time
     */
    private Date createTime;

    /**
     * Social login UID
     */
    private String socialUid;

    /**
     * Social login token
     */
    private String accessToken;

    /**
     * Social login expiration time
     */
    private long expiresIn;

}
