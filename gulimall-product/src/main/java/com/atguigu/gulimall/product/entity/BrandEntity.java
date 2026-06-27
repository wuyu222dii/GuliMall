package com.atguigu.gulimall.product.entity;

import com.atguigu.common.valid.AddGroup;
import com.atguigu.common.valid.ListValue;
import com.atguigu.common.valid.UpdateGroup;
import com.atguigu.common.valid.UpdateStatusGroup;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.io.Serializable;
import java.util.Date;

import lombok.Data;
import org.hibernate.validator.constraints.URL;

import javax.validation.constraints.*;

/**
 * Brand
 *
 * @author liurui
 * @email liurui@gmail.com
 * @date 2023-10-18 13:34:55
 */
@Data
@TableName("pms_brand")
public class BrandEntity implements Serializable {
    private static final long serialVersionUID = 1L;

    /**
     * Brand ID
     */
    @NotNull(message = "ID must be specified for update", groups = {UpdateGroup.class})
    @Null(message = "ID must not be specified for create", groups = {AddGroup.class})
    @TableId
    private Long brandId;
    /**
     * Brand name
     */
    @NotBlank(message = "Brand name is required", groups = {AddGroup.class, UpdateGroup.class})
    private String name;
    /**
     * Brand logo URL
     */
    @NotEmpty(groups = {AddGroup.class})
    @URL(message = "Logo must be a valid URL", groups = {AddGroup.class, UpdateGroup.class})
    private String logo;
    /**
     * Description
     */
    private String descript;
    /**
     * Display status [0-hidden; 1-visible]
     */
    @NotNull(groups = {AddGroup.class, UpdateStatusGroup.class})
    @ListValue(vals = {0, 1}, groups = {AddGroup.class, UpdateStatusGroup.class})
    private Integer showStatus;
    /**
     * Search initials
     */
    @NotEmpty(groups = {AddGroup.class})
    @Pattern(regexp = "^[a-zA-Z]$", message = "The first letter of the search must be one letter", groups = {AddGroup.class, UpdateGroup.class})
    private String firstLetter;
    /**
     * Sort order
     */
    @NotNull(groups = {AddGroup.class})
    @Min(value = 0, message = "Sort order must be >= 0", groups = {AddGroup.class, UpdateGroup.class})
    private Integer sort;

}
