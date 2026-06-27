/**
 * Copyright (c) 2016-2019 Renren Open Source All rights reserved.
 *
 * https://www.renren.io
 *
 * All rights reserved.
 */

package com.atguigu.common.xss;

import com.atguigu.common.exception.RRException;
import org.apache.commons.lang.StringUtils;

/**
 * SQL filter
 *
 * @author Mark sunlightcs@gmail.com
 */
public class SQLFilter {

    /**
     * SQL injection filter
     * @param str  String to validate
     */
    public static String sqlInject(String str){
        if(StringUtils.isBlank(str)){
            return null;
        }
        // Remove ', ", ;, and \ characters
        str = StringUtils.replace(str, "'", "");
        str = StringUtils.replace(str, "\"", "");
        str = StringUtils.replace(str, ";", "");
        str = StringUtils.replace(str, "\\", "");

        // Convert to lowercase
        str = str.toLowerCase();

        // Illegal characters
        String[] keywords = {"master", "truncate", "insert", "select", "delete", "update", "declare", "alter", "drop"};

        // Check whether illegal characters are present
        for(String keyword : keywords){
            if(str.indexOf(keyword) != -1){
                throw new RRException("Contains illegal characters");
            }
        }

        return str;
    }
}
