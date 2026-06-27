package io.renren.adaptor;

import io.renren.entity.mongo.MongoDefinition;
import io.renren.entity.mongo.Type;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * MongoDB adapter
 *
 * @author: gxz gongxuanzhang@foxmail.com
 **/
public class MongoTableInfoAdaptor {

    /**
     * MongoDB table query only returns names; other fields must be filled manually
     *
     * @param names table names
     */
    public static List<Map<String, String>> tableInfo(List<String> names) {
        List<Map<String, String>> result = new ArrayList<>(names.size());
        for (String name : names) {
            result.add(tableInfo(name));
        }
        return result;
    }

    public static Map<String, String> tableInfo(String name) {
        Map<String, String> tableInfo = new HashMap<>(4 * 4 / 3 + 1);
        tableInfo.put("engine", "MongoDB has no engine");
        tableInfo.put("createTime", "MongoDB cannot query create time");
        tableInfo.put("tableComment", "MongoDB has no comment");
        tableInfo.put("tableName", name);
        return tableInfo;
    }

    /**
     * Adapt parsed MongoDB info to relational DB column format when querying columns
     * This method applies to the main bean only
     */
    public static List<Map<String, String>> columnInfo(MongoDefinition mongoDefinition) {
        List<MongoDefinition> child = mongoDefinition.getChild();
        List<Map<String, String>> result = new ArrayList<>(child.size());
        final String mongoKey = "_id";
        for (MongoDefinition definition : child) {
            Map<String, String> map = new HashMap<>(5 * 4 / 3 + 1);
            String type = Type.typeInfo(definition.getType());
            String propertyName = definition.getPropertyName();
            String extra = definition.isArray() ? "array" : "";
            map.put("extra", extra);
            map.put("columnComment", "");
            map.put("dataType", definition.hasChild() ? propertyName : type);
            map.put("columnName", propertyName);
            // MongoDB default primary key is _id
            String columnKey = propertyName.equals(mongoKey) ? "PRI" : "";
            map.put("columnKey", columnKey);
            result.add(map);
        }
        return result;
    }


}
