package io.renren.entity.mongo;


import io.renren.entity.TableEntity;

import java.util.List;
import java.util.Map;

/**
 * MySQL needs one table info and column list per table
 * MongoDB may need multiple entity classes per collection, so they are wrapped in a bean
 *
 * @author gxz
 * @date 2020/5/10 0:14
 */
public class MongoGeneratorEntity {
    /** Table info */
    private Map<String, String> tableInfo;
    /** Main class column info */
    private List<Map<String, String>> columns;


    public TableEntity toTableEntity() {
        TableEntity tableEntity = new TableEntity();
        Map<String, String> tableInfo = this.tableInfo;
        tableEntity.setTableName(tableInfo.get("tableName"));
        tableEntity.setComments("");
        return tableEntity;
    }


    public Map<String, String> getTableInfo() {
        return tableInfo;
    }

    public MongoGeneratorEntity setTableInfo(Map<String, String> tableInfo) {
        this.tableInfo = tableInfo;
        return this;
    }

    public List<Map<String, String>> getColumns() {
        return columns;
    }

    public MongoGeneratorEntity setColumns(List<Map<String, String>> columns) {
        this.columns = columns;
        return this;
    }

}
