package com.atguigu.gulimall.product.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.io.Serializable;
import java.util.Date;
import lombok.Data;

/**
 * spuattribute value
 * 
 * @author liurui
 * @email liurui@gmail.com
 * @date 2023-10-18 13:34:55
 */
@Data
@TableName("pms_product_attr_value")
public class ProductAttrValueEntity implements Serializable {
	private static final long serialVersionUID = 1L;

	/**
	 * id
	 */
	@TableId
	private Long id;
	/**
	 * commodityid
	 */
	private Long spuId;
	/**
	 * propertyid
	 */
	private Long attrId;
	/**
	 * attribute name
	 */
	private String attrName;
	/**
	 * attribute value
	 */
	private String attrValue;
	/**
	 * order
	 */
	private Integer attrSort;
	/**
	 * Quick display [whether to display on the introduction;0-no 1-yes】
	 */
	private Integer quickShow;

}
