package com.atguigu.gulimall.search;

import com.alibaba.fastjson.JSON;
import com.atguigu.gulimall.search.config.GulimallElasticSearchConfig;
import lombok.Data;
import org.apache.ibatis.annotations.Mapper;
import org.elasticsearch.action.index.IndexRequest;
import org.elasticsearch.action.index.IndexResponse;
import org.elasticsearch.action.search.SearchRequest;
import org.elasticsearch.action.search.SearchResponse;
import org.elasticsearch.client.RestHighLevelClient;
import org.elasticsearch.common.collect.Map;
import org.elasticsearch.common.xcontent.XContentType;
import org.elasticsearch.index.query.QueryBuilders;
import org.elasticsearch.search.SearchHit;
import org.elasticsearch.search.SearchHits;
import org.elasticsearch.search.aggregations.AggregationBuilder;
import org.elasticsearch.search.aggregations.AggregationBuilders;
import org.elasticsearch.search.aggregations.bucket.terms.TermsAggregationBuilder;
import org.elasticsearch.search.aggregations.metrics.AvgAggregationBuilder;
import org.elasticsearch.search.builder.SearchSourceBuilder;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.junit4.SpringRunner;

import java.io.IOException;

@RunWith(SpringRunner.class)
@SpringBootTest
public class GulimallSearchApplicationTests {

    @Autowired
    private RestHighLevelClient client;

    @Test
    public void searchData() throws IOException {
        //1, create a search request
        SearchRequest searchRequest = new SearchRequest();
        //Specify index
        searchRequest.indices("bank");
        //SpecifyDSL, search conditions
        //SearchSourceBuilder sourceBuilder Encapsulation conditions
        SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
        searchRequest.source(searchSourceBuilder);
        // 1.1 Construct search conditions
//        searchSourceBuilder.query();
//        searchSourceBuilder.from();
//        searchSourceBuilder.size();
//        searchSourceBuilder.aggregations();
        searchSourceBuilder.query(QueryBuilders.matchQuery("address", "mill"));

        // 1.2 Aggregate by age distribution of values
        TermsAggregationBuilder ageAgg = AggregationBuilders.terms("ageAgg")
                .field("age")
                .size(10);
        searchSourceBuilder.aggregation(ageAgg);

        // 1.3 Calculate average salary
        AvgAggregationBuilder balanceAvg = AggregationBuilders.avg("balanceAvg")
                .field("balance");
        System.out.println("Search conditions" + searchSourceBuilder.toString());
        searchSourceBuilder.aggregation(balanceAvg);

        System.out.println(searchSourceBuilder.toString());
        searchRequest.source(searchSourceBuilder);


        // 2, execute search
        SearchResponse searchResponse = client.search(searchRequest, GulimallElasticSearchConfig.COMMON_OPTIONS);

        // 3, analysis results searchResponse
        System.out.println(searchResponse.toString());
        Map map = JSON.parseObject(searchResponse.toString(), Map.class);
        // 3.1 Get all found data
        SearchHits hits = searchResponse.getHits();
        SearchHit[] searchHits = hits.getHits();
        for (SearchHit hit : searchHits) {
            /**
             * "_index" : "bank",
             *         "_type" : "account",
             *         "_id" : "20",
             *         "_score" : 1.0,
             *         "_source" :
             */
//            hit.getIndex();hit.getType();hit.getId();
            String string = hit.getSourceAsString();
        }
    }

    /**
     * Test storage data toes
     */
    @Test
    public void indexData() throws IOException {
        IndexRequest indexRequest = new IndexRequest("users");
        indexRequest.id("1"); // dataid
//        indexRequest.source("userName","zhangsan","age",18,"gender,","male");
        User user = new User();
        user.setUserName("zhangsan");
        user.setAge(18);
        user.setGender("male");
        String jsonString = JSON.toJSONString(user);
        indexRequest.source(jsonString, XContentType.JSON); // What to save

        // perform operations
        IndexResponse index = client.index(indexRequest, GulimallElasticSearchConfig.COMMON_OPTIONS);

        // Extract useful response data
        System.out.println(index);


    }

    @Data
    class User {
        private String userName;
        private String gender;
        private int age;
    }


    @Test
    public void contextLoads() {
        System.out.println(client);
    }

}
