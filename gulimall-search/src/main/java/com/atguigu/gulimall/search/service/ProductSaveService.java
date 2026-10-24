package com.atguigu.gulimall.search.service;
import com.atguigu.common.to.SearchSyncRequest;
public interface ProductSaveService {
    void ensureIndex();
    void synchronize(SearchSyncRequest request);
}
