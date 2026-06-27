package com.atguigu.gulimall.search.service;

import com.atguigu.gulimall.search.vo.SearchParam;
import com.atguigu.gulimall.search.vo.SearchResult;

public interface MallSearchService {
    /**
     * @param param All parameters retrieved
     * @return Return all results, It contains all the information needed for the page
     */
    SearchResult search(SearchParam param);
}
