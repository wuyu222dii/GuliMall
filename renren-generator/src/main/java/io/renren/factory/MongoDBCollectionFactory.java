package io.renren.factory;

import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.MongoIterable;
import io.renren.config.MongoCondition;
import org.bson.Document;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Conditional;
import org.springframework.stereotype.Component;

import javax.annotation.PostConstruct;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * @author: gxz gongxuanzhang@foxmail.com
 **/

@Component
@Conditional(MongoCondition.class)
public class MongoDBCollectionFactory {

    private static  final String TABLE_NAME_KEY = "tableName";
    private static final String LIMIT_KEY = "limit";
    private static final String OFFSET_KEY = "offset";

    private static MongoDatabase mongoDatabase;

    // Work around static coupling between MongoDB and relational DB code

    @Autowired
    private MongoDatabase database;
    @PostConstruct
    public void initMongoDatabase(){
        mongoDatabase = database;
    }

    /***
     * Get query object by collection name
     * @author gxz
     * @date  2020/5/9
     * @param collectionName MongoDB collection name (table name)
     * @return query object
     **/
    public MongoCollection<Document> getCollection(String collectionName) {
        return mongoDatabase.getCollection(collectionName);
    }

    /***
     * Get collection names in the current database
     * Note: MongoDB table listing cannot be paginated; implemented with stream
     * @author gxz
     * @date  2020/5/9
     * @param map query conditions, same as relational DB
     * @return collection names
     **/
    public static List<String>  getCollectionNames(Map<String, Object> map) {
        int limit = Integer.valueOf(map.get(LIMIT_KEY).toString());
        int skip = Integer.valueOf(map.get(OFFSET_KEY).toString());
        List<String> names;
        if (map.containsKey(TABLE_NAME_KEY)) {
            names = getCollectionNames(map.get(TABLE_NAME_KEY).toString());
        } else {
            names = getCollectionNames();
        }
        return names.stream().skip(skip).limit(limit).collect(Collectors.toList());
    }
    /***
     * Total collection count for MyBatis-Plus pagination
     * @author gxz
     * @date  2020/5/9
     * @param map query conditions, same as relational DB
     * @return int
     **/
    public static int getCollectionTotal(Map<String, Object> map) {
        if (map.containsKey(TABLE_NAME_KEY)) {
            return getCollectionNames(map.get(TABLE_NAME_KEY).toString()).size();
        }
        return getCollectionNames().size();

    }


    private static List<String> getCollectionNames() {
        MongoIterable<String> names = mongoDatabase.listCollectionNames();
        List<String> result = new ArrayList<>();
        for (String name : names) {
            result.add(name);
        }
        return result;
    }

    private static List<String> getCollectionNames(String likeName) {
        return getCollectionNames()
                .stream()
                .filter((name) -> name.contains(likeName)).collect(Collectors.toList());
    }
}
