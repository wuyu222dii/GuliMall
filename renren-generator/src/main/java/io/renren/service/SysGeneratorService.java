/**
 * Copyright (c) 2018 Renren Open Source All rights reserved.
 * <p>
 * https://www.renren.io
 * <p>
 * All rights reserved.
 */

package io.renren.service;

import com.github.pagehelper.Page;
import com.github.pagehelper.PageHelper;
import io.renren.config.MongoManager;
import io.renren.dao.GeneratorDao;
import io.renren.dao.MongoDBGeneratorDao;
import io.renren.entity.mongo.MongoDefinition;
import io.renren.factory.MongoDBCollectionFactory;
import io.renren.utils.GenUtils;
import io.renren.utils.PageUtils;
import io.renren.utils.Query;
import org.apache.commons.io.IOUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipOutputStream;

/**
 * Code generator
 *
 * @author Mark sunlightcs@gmail.com
 */
@Service
public class SysGeneratorService {
    @Autowired
    private GeneratorDao generatorDao;


    public PageUtils queryList(Query query) {
        Page<?> page = PageHelper.startPage(query.getPage(), query.getLimit());
        List<Map<String, Object>> list = generatorDao.queryList(query);
        int total = (int) page.getTotal();
        if (generatorDao instanceof MongoDBGeneratorDao) {
            total = MongoDBCollectionFactory.getCollectionTotal(query);
        }
        return new PageUtils(list, total, query.getLimit(), query.getPage());
    }

    public Map<String, String> queryTable(String tableName) {
        return generatorDao.queryTable(tableName);
    }

    public List<Map<String, String>> queryColumns(String tableName) {
        return generatorDao.queryColumns(tableName);
    }


    public byte[] generatorCode(String[] tableNames) {
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        ZipOutputStream zip = new ZipOutputStream(outputStream);
        for (String tableName : tableNames) {
            // Query table info
            Map<String, String> table = queryTable(tableName);
            // Query column info
            List<Map<String, String>> columns = queryColumns(tableName);
            // Generate code
            GenUtils.generatorCode(table, columns, zip);
        }
        if (MongoManager.isMongo()) {
            GenUtils.generatorMongoCode(tableNames, zip);
        }


        IOUtils.closeQuietly(zip);
        return outputStream.toByteArray();
    }
}
