package io.renren.entity;

/**
 * Column properties
 * 
 * @author chenshun
 * @email sunlightcs@gmail.com
 * @date Dec 20, 2016
 */
public class ColumnEntity {
	// Column name
    private String columnName;
    // Column type
    private String dataType;
    // Column comment
    private String comments;
    
    // Property name (PascalCase), e.g. user_name => UserName
    private String attrName;
    // Property name (camelCase), e.g. user_name => userName
    private String attrname;
    // Property type
    private String attrType;
    //auto_increment
    private String extra;
    
	public String getColumnName() {
		return columnName;
	}
	public void setColumnName(String columnName) {
		this.columnName = columnName;
	}
	public String getDataType() {
		return dataType;
	}
	public void setDataType(String dataType) {
		this.dataType = dataType;
	}
	public String getComments() {
		return comments;
	}
	public void setComments(String comments) {
		this.comments = comments;
	}
	public String getAttrname() {
		return attrname;
	}
	public void setAttrname(String attrname) {
		this.attrname = attrname;
	}
	public String getAttrName() {
		return attrName;
	}
	public void setAttrName(String attrName) {
		this.attrName = attrName;
	}
	public String getAttrType() {
		return attrType;
	}
	public void setAttrType(String attrType) {
		this.attrType = attrType;
	}
	public String getExtra() {
		return extra;
	}
	public void setExtra(String extra) {
		this.extra = extra;
	}
}
